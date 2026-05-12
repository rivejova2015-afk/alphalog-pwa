// Pure evaluator — takes pre-loaded bars and config, returns a SignalResult.
// No I/O. Used by both runEngineV1 (DB-backed live polling) and
// simulateEngineV1 (in-memory backtest replay).

import type { EngineConfig } from "@/lib/validations/engine-config";
import type {
  EngineContext,
  ModuleStatus,
  MultiTfConfig,
  SignalResult,
  TfState,
  BarsByTf,
} from "./types";
import { tfTrendBias } from "./trend";
import { combineBiasWeighted } from "./cascade";
import { inAnySession } from "./sessions";
import { lotsForPhase } from "./capital-phases";
import { structureBias } from "./structure";
import { checkDecisionEngine } from "./overlays/decision-engine";
import { checkRangeGate } from "./overlays/range-gate";
import { checkOrderFlow } from "./overlays/order-flow";
import { checkPulseEngine } from "./overlays/pulse-engine";

const STRUCTURE_TFS = new Set(["M15", "H1"]);

export interface EvaluatorAlgorithm {
  id: string;
  lot_size?: number | null;
  engine_config: EngineConfig | null;
  parameters: Record<string, unknown> | null;
}

export interface BreakerState {
  tripped: boolean;
  reason?: string;
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

function signalIdFor(algoId: string, symbol: string, lastBarTs: string | undefined, side: string): string {
  const seed = `${algoId}:${symbol}:${lastBarTs ?? "no-bar"}:${side}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return `eng1-${Math.abs(h).toString(36)}`;
}

export function evaluateEngineV1(
  algorithm: EvaluatorAlgorithm,
  ctx: EngineContext,
  mtf: MultiTfConfig,
  barsByTf: BarsByTf,
  breakerState: BreakerState = { tripped: false },
): SignalResult {
  const modules: ModuleStatus[] = [];
  const cfg = algorithm.engine_config;

  // Session guard
  const sessionsForSymbol = mtf.sessions?.[ctx.symbol] ?? null;
  if (!inAnySession(sessionsForSymbol, ctx.now)) {
    modules.push({ name: "session", enabled: true, tripped: true, reason: "outside_session_window" });
    return holdResult("outside_session_window", modules);
  }
  modules.push({ name: "session", enabled: true, tripped: false });

  // Circuit breaker (state passed in from caller — checked against DB live,
  // or from accumulated trades during backtest replay).
  if (cfg?.modules?.circuit_breaker?.enabled) {
    modules.push({ name: "circuit_breaker", enabled: true, tripped: breakerState.tripped, reason: breakerState.reason });
    if (breakerState.tripped) return holdResult(`circuit_breaker:${breakerState.reason ?? "tripped"}`, modules);
  } else {
    modules.push({ name: "circuit_breaker", enabled: false });
  }

  // Per-TF bias (trend + optional structure overlay on lower TFs)
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

  // Cascade
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

  // Overlays
  const m15 = barsByTf.get("M15") ?? [];
  const h1  = barsByTf.get("H1")  ?? [];
  const m5  = barsByTf.get("M5")  ?? [];
  const m1  = barsByTf.get("M1")  ?? [];

  if (cfg?.overlays) {
    const decision = checkDecisionEngine(cfg.overlays.decision_engine, cascade.side, cascade.score);
    modules.push({ name: "decision_engine", enabled: cfg.overlays.decision_engine.enabled, tripped: !decision.passed, reason: decision.reason });
    if (!decision.passed) return holdResult(`decision_engine:${decision.reason ?? "blocked"}`, modules, { bias_score: cascade.score, tfs: tfStates });

    const rangeBars = m15.length > 15 ? m15 : h1;
    const range = checkRangeGate(cfg.overlays.range_gate, rangeBars);
    modules.push({ name: "range_gate", enabled: cfg.overlays.range_gate.enabled, tripped: !range.passed, reason: range.reason });
    if (!range.passed) return holdResult(`range_gate:${range.reason ?? "blocked"}`, modules, { bias_score: cascade.score, tfs: tfStates });

    const flow = checkOrderFlow(cfg.overlays.order_flow, cascade.side, h1.length > 0 ? h1 : m15);
    modules.push({ name: "order_flow", enabled: cfg.overlays.order_flow.enabled, tripped: !flow.passed, reason: flow.reason });
    if (!flow.passed) return holdResult(`order_flow:${flow.reason ?? "blocked"}`, modules, { bias_score: cascade.score, tfs: tfStates });

    const pulse = checkPulseEngine(cfg.overlays.pulse_engine, cascade.side, m1, m5);
    modules.push({ name: "pulse_engine", enabled: cfg.overlays.pulse_engine.enabled, tripped: !pulse.passed, reason: pulse.reason });
    if (!pulse.passed) return holdResult(`pulse_engine:${pulse.reason ?? "blocked"}`, modules, { bias_score: cascade.score, tfs: tfStates });
  }

  const confidence = Math.min(1, Math.abs(cascade.score - 50) / 50);

  // Sizing via capital_phases
  const baseLots = algorithm.lot_size ?? 0.01;
  const phasesCfg = cfg?.modules?.capital_phases;
  const equity = ctx.currentEquity ?? phasesCfg?.starting_capital ?? 100;
  const lots = phasesCfg ? lotsForPhase(phasesCfg, equity, baseLots) : baseLots;
  modules.push({
    name: "capital_phases",
    enabled: !!phasesCfg?.enabled,
  });

  let lastBarTs: string | undefined;
  for (const t of mtf.timeframes) {
    const bars = barsByTf.get(t.tf) ?? [];
    if (bars.length > 0) { lastBarTs = bars[bars.length - 1].ts; break; }
  }

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
