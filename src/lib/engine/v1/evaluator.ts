// Base Engine v1 — pure evaluator. Implements the top-down SMC funnel:
//
//   D1  → previous day high/low + which level price manipulated (sweep)
//   H1  → session structure (bull/bear) + nearby liquidity
//   gate → setup is valid only when the swept side aligns with H1 bias
//          (PDH swept ↔ H1 bullish, PDL swept ↔ H1 bearish)
//   M15 → Break of Structure. The BOS direction IS the trade direction —
//          "a favor" (same as H1) or "en contra" (against H1, = structure
//          change). Both are tradable. Hands down the nearest OB.
//   M1  → entry trigger: price trades into that OB, or into an M1 FVG, in
//          the trade direction → emit BUY/SELL.
//
// Any step that doesn't line up → HOLD with an explicit reason. The five
// overlays (decision_engine, order_flow, range_gate, pulse_engine, ml_signal)
// run AFTER the funnel produces a trade, as optional post-entry filters —
// they are not part of the core decision.
//
// No I/O. Powers both runEngineV1 (live) and simulateEngineV1 (backtest).

import type { EngineConfig } from "@/lib/validations/engine-config";
import type {
  EngineContext,
  FunnelTrace,
  ModuleStatus,
  MultiTfConfig,
  SignalResult,
  BarsByTf,
} from "./types";
import type { Bar } from "@/types/backtest";
import { inAnySession } from "./sessions";
import { lotsForPhase } from "./capital-phases";
import { computeDailyLevels } from "./daily-levels";
import { sessionStructure } from "./session-structure";
import { detectBOS } from "./bos";
import { findEntry } from "./entry";
import { checkDecisionEngine } from "./overlays/decision-engine";
import { checkRangeGate } from "./overlays/range-gate";
import { checkOrderFlow } from "./overlays/order-flow";
import { checkPulseEngine } from "./overlays/pulse-engine";
import { checkMlSignal, type MlOverlayConfig } from "./overlays/ml-signal";
import type { MlModel } from "@/lib/backtest/ml-signal";

// Role → fallback timeframe. The evaluator resolves bars by the template's
// `role` field (lesson learned: drive behavior off the data model, not a
// hardcoded TF set); the fallback only applies if the template omits the role.
const ROLE_DAILY_LEVELS      = "daily_levels";
const ROLE_SESSION_STRUCTURE = "session_structure";
const ROLE_BOS_OB            = "bos_ob";
const ROLE_ENTRY             = "entry";

const ROLE_FALLBACK_TF: Record<string, string> = {
  [ROLE_DAILY_LEVELS]:      "D1",
  [ROLE_SESSION_STRUCTURE]: "H1",
  [ROLE_BOS_OB]:            "M15",
  [ROLE_ENTRY]:             "M1",
};

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

export interface EvaluatorExtras {
  breakerState?: BreakerState;
  mlModel?: MlModel | null;
  mlMinProbability?: number;
}

const ML_DEFAULT_THRESHOLD = 0.55;

function holdResult(reason: string, modules: ModuleStatus[], extras: Partial<SignalResult> = {}): SignalResult {
  return { action: "HOLD", lots: 0, confidence: 0, signalId: "", reason, modules, ...extras };
}

function signalIdFor(algoId: string, symbol: string, lastBarTs: string | undefined, side: string): string {
  const seed = `${algoId}:${symbol}:${lastBarTs ?? "no-bar"}:${side}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `eng1-${Math.abs(h).toString(36)}`;
}

function barsForRole(mtf: MultiTfConfig, barsByTf: BarsByTf, role: string): Bar[] {
  const t = mtf.timeframes.find((x) => x.role === role);
  const tf = t?.tf ?? ROLE_FALLBACK_TF[role];
  return (tf && barsByTf.get(tf)) || [];
}

export function evaluateEngineV1(
  algorithm: EvaluatorAlgorithm,
  ctx: EngineContext,
  mtf: MultiTfConfig,
  barsByTf: BarsByTf,
  breakerStateOrExtras: BreakerState | EvaluatorExtras = { tripped: false },
): SignalResult {
  // Back-compat: accept a bare BreakerState or the EvaluatorExtras envelope.
  const extras: EvaluatorExtras = "tripped" in breakerStateOrExtras
    ? { breakerState: breakerStateOrExtras as BreakerState }
    : breakerStateOrExtras as EvaluatorExtras;
  const breakerState = extras.breakerState ?? { tripped: false };
  const mlModel = extras.mlModel ?? null;
  const mlMinProb = extras.mlMinProbability ?? ML_DEFAULT_THRESHOLD;

  const modules: ModuleStatus[] = [];
  const cfg = algorithm.engine_config;

  const funnel: FunnelTrace = {
    pdh: null, pdl: null, swept: null,
    h1Bias: "neutral", setupSide: null,
    bosDirection: null, bosKind: null, entryZone: null,
  };

  // ── Session guard ─────────────────────────────────────────────────────────
  const sessionsForSymbol = mtf.sessions?.[ctx.symbol] ?? null;
  if (!inAnySession(sessionsForSymbol, ctx.now)) {
    modules.push({ name: "session", enabled: true, tripped: true, reason: "outside_session_window" });
    return holdResult("outside_session_window", modules, { funnel });
  }
  modules.push({ name: "session", enabled: true, tripped: false });

  // ── Circuit breaker ───────────────────────────────────────────────────────
  if (cfg?.modules?.circuit_breaker?.enabled) {
    modules.push({ name: "circuit_breaker", enabled: true, tripped: breakerState.tripped, reason: breakerState.reason });
    if (breakerState.tripped) return holdResult(`circuit_breaker:${breakerState.reason ?? "tripped"}`, modules, { funnel });
  } else {
    modules.push({ name: "circuit_breaker", enabled: false });
  }

  // ── Resolve bars per funnel role ──────────────────────────────────────────
  const d1Bars  = barsForRole(mtf, barsByTf, ROLE_DAILY_LEVELS);
  const h1Bars  = barsForRole(mtf, barsByTf, ROLE_SESSION_STRUCTURE);
  const m15Bars = barsForRole(mtf, barsByTf, ROLE_BOS_OB);
  const m1Bars  = barsForRole(mtf, barsByTf, ROLE_ENTRY);

  // ── Step 1 — D1: previous day high/low + sweep ────────────────────────────
  const daily = computeDailyLevels(d1Bars, m15Bars);
  if (!daily) {
    modules.push({ name: "daily_levels", enabled: true, tripped: true, reason: "insufficient_d1_bars" });
    return holdResult("insufficient_d1_bars", modules, { funnel });
  }
  funnel.pdh = daily.pdh;
  funnel.pdl = daily.pdl;
  funnel.swept = daily.swept;
  modules.push({ name: "daily_levels", enabled: true, tripped: daily.swept === null, reason: daily.swept ? `swept:${daily.swept}` : "no_sweep" });
  if (daily.swept === null) {
    return holdResult("no_d1_liquidity_sweep", modules, { funnel });
  }

  // ── Step 2 — H1: session structure ────────────────────────────────────────
  const structure = sessionStructure(h1Bars);
  funnel.h1Bias = structure.bias;
  modules.push({ name: "session_structure", enabled: true, tripped: structure.bias === "neutral", reason: `bias:${structure.bias}` });

  // ── Setup gate — swept side must align with H1 bias ───────────────────────
  // PDH swept ↔ H1 bullish, PDL swept ↔ H1 bearish. (Interpretation from the
  // four worked examples — all of them satisfy this alignment.)
  let setupSide: "bull" | "bear" | null = null;
  if (daily.swept === "PDH" && structure.bias === "bull") setupSide = "bull";
  else if (daily.swept === "PDL" && structure.bias === "bear") setupSide = "bear";
  funnel.setupSide = setupSide;
  if (!setupSide) {
    return holdResult(`no_setup:swept_${daily.swept}_h1_${structure.bias}`, modules, { funnel });
  }

  // ── Step 3 — M15: Break of Structure ──────────────────────────────────────
  const bos = detectBOS(m15Bars);
  funnel.bosDirection = bos.direction;
  if (!bos.direction) {
    modules.push({ name: "bos_ob", enabled: true, tripped: true, reason: "no_bos" });
    return holdResult("no_m15_bos", modules, { funnel });
  }
  // The BOS direction IS the trade direction — whether a favor or en contra.
  const tradeDir = bos.direction;
  funnel.bosKind = bos.direction === structure.bias ? "a_favor" : "en_contra";
  modules.push({ name: "bos_ob", enabled: true, tripped: false, reason: `${bos.direction}_${funnel.bosKind}` });

  // ── Step 4 — M1: entry into OB or FVG ─────────────────────────────────────
  const entry = findEntry(m1Bars, tradeDir, bos.nearestOB);
  funnel.entryZone = entry.zone;
  modules.push({ name: "entry", enabled: true, tripped: !entry.triggered, reason: entry.reason });
  if (!entry.triggered) {
    return holdResult(`entry:${entry.reason}`, modules, { funnel });
  }

  const side: "BUY" | "SELL" = tradeDir === "bull" ? "BUY" : "SELL";

  // Funnel confidence: a-favor (structure-confirmed) and OB entries are the
  // cleaner setups per spec ("se busca el OB más cercano").
  let confidence = 0.6;
  if (funnel.bosKind === "a_favor") confidence += 0.15;
  if (entry.zone === "ob") confidence += 0.10;
  confidence = Math.min(1, confidence);
  const overlayScore = confidence * 100;

  // ── Optional overlays — post-entry filters, off unless toggled ────────────
  if (cfg?.overlays) {
    const decision = checkDecisionEngine(cfg.overlays.decision_engine, side, overlayScore);
    modules.push({ name: "decision_engine", enabled: cfg.overlays.decision_engine.enabled, tripped: !decision.passed, reason: decision.reason });
    if (!decision.passed) return holdResult(`decision_engine:${decision.reason ?? "blocked"}`, modules, { funnel });

    const rangeBars = m15Bars.length > 15 ? m15Bars : h1Bars;
    const range = checkRangeGate(cfg.overlays.range_gate, rangeBars);
    modules.push({ name: "range_gate", enabled: cfg.overlays.range_gate.enabled, tripped: !range.passed, reason: range.reason });
    if (!range.passed) return holdResult(`range_gate:${range.reason ?? "blocked"}`, modules, { funnel });

    const flow = checkOrderFlow(cfg.overlays.order_flow, side, h1Bars.length > 0 ? h1Bars : m15Bars);
    modules.push({ name: "order_flow", enabled: cfg.overlays.order_flow.enabled, tripped: !flow.passed, reason: flow.reason });
    if (!flow.passed) return holdResult(`order_flow:${flow.reason ?? "blocked"}`, modules, { funnel });

    const pulse = checkPulseEngine(cfg.overlays.pulse_engine, side, m1Bars, []);
    modules.push({ name: "pulse_engine", enabled: cfg.overlays.pulse_engine.enabled, tripped: !pulse.passed, reason: pulse.reason });
    if (!pulse.passed) return holdResult(`pulse_engine:${pulse.reason ?? "blocked"}`, modules, { funnel });
  }

  // ML overlay — only active when a trained model is supplied.
  const mlCfg: MlOverlayConfig = { enabled: !!mlModel, min_probability: mlMinProb };
  const ml = checkMlSignal(mlCfg, side, m15Bars.length > 0 ? m15Bars : m1Bars, mlModel);
  modules.push({ name: "ml_signal", enabled: mlCfg.enabled, tripped: !ml.passed, reason: ml.reason });
  if (!ml.passed) return holdResult(`ml_signal:${ml.reason ?? "blocked"}`, modules, { funnel });

  // ── Sizing via capital_phases ─────────────────────────────────────────────
  const baseLots = algorithm.lot_size ?? 0.01;
  const phasesCfg = cfg?.modules?.capital_phases;
  const equity = ctx.currentEquity ?? phasesCfg?.starting_capital ?? 100;
  const lots = phasesCfg ? lotsForPhase(phasesCfg, equity, baseLots) : baseLots;
  modules.push({ name: "capital_phases", enabled: !!phasesCfg?.enabled });

  const lastBarTs = m1Bars.length > 0 ? m1Bars[m1Bars.length - 1].ts
    : m15Bars.length > 0 ? m15Bars[m15Bars.length - 1].ts : undefined;

  return {
    action: side,
    lots,
    confidence,
    signalId: signalIdFor(algorithm.id, ctx.symbol, lastBarTs, side),
    reason: `${side.toLowerCase()}:bos_${funnel.bosKind}:entry_${entry.zone}`,
    funnel,
    modules,
  };
}
