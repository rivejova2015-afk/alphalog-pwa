// Base Engine v1 — DB-backed live runner. Thin wrapper around `evaluateEngineV1`
// that handles I/O (loading bars, checking circuit breaker against
// algorithm_trades) and then delegates to the pure evaluator. The same
// evaluator powers `simulateEngineV1` (backtest replay) — see `backtest.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type {
  EngineContext,
  MultiTfConfig,
  SessionWindow,
  SignalResult,
  TimeframeWeight,
} from "./types";
import { loadBarsForTfs } from "./bar-loader";
import { checkBreaker } from "./circuit-breaker";
import { evaluateEngineV1 } from "./evaluator";

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

export function extractMultiTf(parameters: Record<string, unknown> | null): MultiTfConfig {
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

export async function runEngineV1(
  supabase: SupabaseClient,
  algorithm: AlgorithmRow,
  ctx: EngineContext,
): Promise<SignalResult> {
  const cfg = algorithm.engine_config;
  const mtf = extractMultiTf(algorithm.parameters);

  // Load bars per TF
  const tfs = mtf.timeframes.map((t) => t.tf);
  let barsByTf;
  try {
    barsByTf = await loadBarsForTfs(supabase, ctx.symbol, tfs);
  } catch {
    return {
      action: "HOLD",
      lots: 0,
      confidence: 0,
      signalId: "",
      reason: "bar_loader_failed",
      modules: [],
    };
  }

  // Circuit breaker — DB-backed for live polling
  let breakerState = { tripped: false, reason: undefined as string | undefined };
  if (cfg?.modules?.circuit_breaker?.enabled) {
    const equity = ctx.currentEquity ?? cfg.modules.capital_phases?.starting_capital ?? 100;
    const r = await checkBreaker(supabase, algorithm.id, cfg.modules.circuit_breaker, equity);
    breakerState = { tripped: r.tripped, reason: r.reason };
  }

  return evaluateEngineV1(
    {
      id: algorithm.id,
      lot_size: algorithm.lot_size,
      engine_config: cfg,
      parameters: algorithm.parameters,
    },
    ctx,
    mtf,
    barsByTf,
    breakerState,
  );
}
