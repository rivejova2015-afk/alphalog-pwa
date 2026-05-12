// Base Engine v1 — orchestrator. Pulls together session guard, circuit
// breaker, multi-timeframe trend cascade, and capital-phase sizing into a
// single SignalResult. Any failure inside any module degrades to HOLD with
// a non-empty `reason` — the EA never receives an action it can't act on.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type {
  EngineContext,
  ModuleStatus,
  MultiTfConfig,
  SessionWindow,
  SignalResult,
  TfState,
  TimeframeWeight,
} from "./types";
import { loadBarsForTfs } from "./bar-loader";
import { tfTrendBias } from "./trend";
import { combineBiasWeighted } from "./cascade";
import { inAnySession } from "./sessions";
import { checkBreaker } from "./circuit-breaker";
import { lotsForPhase } from "./capital-phases";
import { structureBias } from "./structure";

// Structure (OB/FVG) only applied to lower TFs where it carries signal.
const STRUCTURE_TFS = new Set(["M15", "H1"]);

interface AlgorithmRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  engine_config: EngineConfig | null;
  parameters: Record<string, unknown> | null;
  instrument: string[] | string | null;
  lot_size?: number | null;
  risk_percent?: number | null;
}

const DEFAULT_TIMEFRAMES: TimeframeWeight[] = [
  { tf: "D1",  weight: 0.30, role: "trend_liquidity" },
  { tf: "H4",  weight: 0.25, role: "structure_liquidity" },
  { tf: "H1",  weight: 0.20, role: "structure_session" },
  { tf: "M15", weight: 0.15, role: "order_blocks" },
  { tf: "M5",  weight: 0.07, role: "impulse_confirm" },
  { tf: "M1",  weight: 0.03, role: "execution" },
];

function extractMultiTf(parameters: Record<string, unknown> | null): MultiTfConfig {
  if (!parameters || typeof parameters !== "object") {
    return { timeframes: DEFAULT_TIMEFRAMES };
  }
  const mtf = (parameters as { multi_tf?: unknown }).multi_tf;
  if (!mtf || typeof mtf !== "object") {
    return { timeframes: DEFAULT_TIMEFRAMES };
  }
  const obj = mtf as { timeframes?: TimeframeWeight[]; min_bias_score?: number; sessions?: Record<string, SessionWindow[]> };
  return {
    timeframes: Array.isArray(obj.timeframes) && obj.timeframes.length > 0 ? obj.timeframes : DEFAULT_TIMEFRAMES,
    min_bias_score: typeof obj.min_bias_score === "number" ? obj.min_bias_score : undefined,
    sessions: obj.sessions ?? undefined,
  };
}

function signalIdFor(algoId: string, symbol: string, lastBarTs: string | undefined, side: string): string {
  const seed = `${algoId}:${symbol}:${lastBarTs ?? "no-bar"}:${side}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return `eng1-${Math.abs(h).toString(36)}`;
}

function holdResult(reason: string, modules: ModuleStatus[], extras: Partial<SignalResult> = {}): SignalResult {
  return {
    action: "HOLD",
    lots: 0,
    confidence: 0,
    signalId: "",
    reason,
    modules,
    ...extras,
  };
}

export async function runEngineV1(
  supabase: SupabaseClient,
  algorithm: AlgorithmRow,
  ctx: EngineContext,
): Promise<SignalResult> {
  const modules: ModuleStatus[] = [];
  const cfg = algorithm.engine_config;
  const mtf = extractMultiTf(algorithm.parameters);

  // 1. Session guard
  const sessionsForSymbol = mtf.sessions?.[ctx.symbol] ?? null;
  if (!inAnySession(sessionsForSymbol, ctx.now)) {
    modules.push({ name: "session", enabled: true, tripped: true, reason: "outside_session_window" });
    return holdResult("outside_session_window", modules);
  }
  modules.push({ name: "session", enabled: true, tripped: false });

  // 2. Circuit breaker
  if (cfg?.modules?.circuit_breaker?.enabled) {
    const equity = ctx.currentEquity ?? cfg.modules.capital_phases?.starting_capital ?? 100;
    const breaker = await checkBreaker(supabase, algorithm.id, cfg.modules.circuit_breaker, equity);
    modules.push({ name: "circuit_breaker", enabled: true, tripped: breaker.tripped, reason: breaker.reason });
    if (breaker.tripped) return holdResult(`circuit_breaker:${breaker.reason ?? "tripped"}`, modules);
  } else {
    modules.push({ name: "circuit_breaker", enabled: false });
  }

  // 3. Load bars per TF
  const tfs = mtf.timeframes.map((t) => t.tf);
  let barsByTf;
  try {
    barsByTf = await loadBarsForTfs(supabase, ctx.symbol, tfs);
  } catch {
    return holdResult("bar_loader_failed", modules);
  }

  // 4. Compute per-TF bias (trend + optional structure overlay on lower TFs)
  const tfStates: TfState[] = mtf.timeframes.map((t) => {
    const bars = barsByTf.get(t.tf) ?? [];
    const trend = tfTrendBias(bars);
    const struct = STRUCTURE_TFS.has(t.tf) ? structureBias(bars).bias : 0;
    const combined = Math.max(-100, Math.min(100, trend + struct));
    return {
      tf: t.tf,
      weight: t.weight,
      role: t.role,
      bias: combined,
      bars: bars.length,
    };
  });

  // 5. Cascade
  const minBiasScore = cfg?.modules?.cascade_probability?.enabled
    ? cfg.modules.cascade_probability.min_bias_score
    : mtf.min_bias_score ?? 60;
  const buyThreshold = Math.max(50, Math.min(100, minBiasScore));
  const sellThreshold = 100 - buyThreshold;
  const cascade = combineBiasWeighted(tfStates, buyThreshold, sellThreshold);

  modules.push({
    name: "cascade_probability",
    enabled: !!cfg?.modules?.cascade_probability?.enabled,
    tripped: cascade.side === "NONE",
    reason: cascade.side === "NONE" ? `score:${cascade.score.toFixed(1)}` : undefined,
  });

  if (cascade.side === "NONE") {
    return holdResult(`bias_below_threshold:${cascade.score.toFixed(1)}`, modules, {
      bias_score: cascade.score,
      tfs: tfStates,
    });
  }

  // Confidence: distance from neutral, clipped to [0, 1].
  const confidence = Math.min(1, Math.abs(cascade.score - 50) / 50);

  // 6. Sizing via capital_phases
  const baseLots = algorithm.lot_size ?? 0.01;
  const phasesCfg = cfg?.modules?.capital_phases;
  const equity = ctx.currentEquity ?? phasesCfg?.starting_capital ?? 100;
  const lots = phasesCfg ? lotsForPhase(phasesCfg, equity, baseLots) : baseLots;
  modules.push({
    name: "capital_phases",
    enabled: !!phasesCfg?.enabled,
  });

  const lastBarTs = (() => {
    for (const tf of tfs) {
      const bars = barsByTf.get(tf) ?? [];
      if (bars.length > 0) return bars[bars.length - 1].ts;
    }
    return undefined;
  })();

  return {
    action: cascade.side,
    lots,
    confidence,
    signalId: signalIdFor(algorithm.id, ctx.symbol, lastBarTs, cascade.side),
    reason: `bias_score:${cascade.score.toFixed(1)}`,
    bias_score: cascade.score,
    tfs: tfStates,
    modules,
  };
}
