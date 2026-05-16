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
import type { MlModel } from "@/lib/backtest/ml-signal";

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

// Base Engine v1 — the four timeframes of the SMC funnel. `weight` is kept in
// the shape for schema compatibility but the funnel is sequential, not a
// weighted score — the evaluator gates D1 → H1 → M15 → M1 in order. What
// matters is `role`, which the evaluator resolves against.
const DEFAULT_TIMEFRAMES: TimeframeWeight[] = [
  { tf: "D1",  weight: 0, role: "daily_levels" },       // prev day high/low + sweep
  { tf: "H1",  weight: 0, role: "session_structure" },  // session bias + liquidity
  { tf: "M15", weight: 0, role: "bos_ob" },             // break of structure + OB
  { tf: "M1",  weight: 0, role: "entry" },              // entry into OB / FVG
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

  // ML model — load the latest trained logreg for this algorithm if any.
  // No-op overlay when no model exists (graceful default).
  let mlModel: MlModel | null = null;
  try {
    const { data: row } = await supabase
      .from("ml_models")
      .select("weights, feature_names, train_acc, valid_acc")
      .eq("algorithm_id", algorithm.id)
      .eq("user_id", algorithm.user_id)
      .eq("kind", "logreg")
      .order("trained_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row?.weights) {
      const w = row.weights as {
        weights: number[];
        bias: number;
        featureMeans: number[];
        featureStds: number[];
        featureNames: string[];
      };
      mlModel = {
        weights:      w.weights,
        bias:         w.bias,
        featureMeans: w.featureMeans,
        featureStds:  w.featureStds,
        featureNames: w.featureNames,
        trainAcc:     Number(row.train_acc ?? 0),
        validAcc:     Number(row.valid_acc ?? 0),
      };
    }
  } catch { /* non-critical — overlay degrades to pass-through */ }

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
    { breakerState, mlModel },
  );
}
