// Engine v1 quality gates — lightweight pass/fail check on a baseline backtest
// result. Distinct from the legacy algorithm_quality_gate_definitions table
// (those score the rule-based backtest). These gates are tuned for the engine
// v1 simulator and are used to auto-advance a strategy draft → paper once it
// proves itself on historical data.
//
// "must" gates are required for promotion; "should" gates are advisory only.
//
// Ephemeral/in-memory: computed on a just-run backtest's metrics, returned in
// the API response, never persisted to a table. This is ONE of three
// independent "quality gate" systems in this repo (Wave 3 item 9 audit,
// 2026-07) — the other two are src/lib/quality-gates/runner.ts (the
// DB-persisted deploy-time Tier-1 gates) and
// coinarb/scripts/check-backtest-threshold.ts (manual/local regression
// script for coinarb). None of the three call or read from each other —
// intentional, each gates a different lifecycle stage.

import type { BacktestMetrics } from "@/types/backtest";

export type GateOp = ">=" | "<=" | ">";

export interface GateDef {
  key: keyof BacktestMetrics;
  label: string;
  op: GateOp;
  threshold: number;
  tier: "must" | "should";
}

export interface GateResult {
  key: string;
  label: string;
  op: GateOp;
  threshold: number;
  tier: "must" | "should";
  value: number | null;
  passed: boolean;
}

export interface GateEvaluation {
  results: GateResult[];
  mustPassed: number;
  mustTotal: number;
  shouldPassed: number;
  shouldTotal: number;
  allMustPassed: boolean;
  eligibleForPaper: boolean;
}

// Conservative defaults — a strategy clearing all `must` gates has a real
// historical edge, not just noise.
export const ENGINE_V1_GATES: GateDef[] = [
  { key: "totalTrades",    label: "Min 20 trades",     op: ">=", threshold: 20,   tier: "must"   },
  { key: "profitFactor",   label: "Profit factor ≥ 1.2", op: ">=", threshold: 1.2, tier: "must"   },
  { key: "totalPnl",       label: "Positive PnL",      op: ">",  threshold: 0,    tier: "must"   },
  { key: "maxDrawdownPct", label: "Max DD ≤ 25%",      op: "<=", threshold: 0.25, tier: "must"   },
  { key: "winRate",        label: "Win rate ≥ 40%",    op: ">=", threshold: 0.40, tier: "should" },
  { key: "sharpe",         label: "Sharpe ≥ 0.8",      op: ">=", threshold: 0.8,  tier: "should" },
  { key: "expectancy",     label: "Positive expectancy", op: ">", threshold: 0,   tier: "should" },
];

function applyOp(value: number, op: GateOp, threshold: number): boolean {
  if (op === ">=") return value >= threshold;
  if (op === "<=") return value <= threshold;
  return value > threshold;
}

export function evaluateEngineGates(
  metrics: BacktestMetrics,
  gates: GateDef[] = ENGINE_V1_GATES,
): GateEvaluation {
  const results: GateResult[] = gates.map((g) => {
    const raw = metrics[g.key];
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const passed = value != null && applyOp(value, g.op, g.threshold);
    return {
      key: g.key as string,
      label: g.label,
      op: g.op,
      threshold: g.threshold,
      tier: g.tier,
      value,
      passed,
    };
  });

  const must = results.filter((r) => r.tier === "must");
  const should = results.filter((r) => r.tier === "should");
  const mustPassed = must.filter((r) => r.passed).length;
  const shouldPassed = should.filter((r) => r.passed).length;
  const allMustPassed = must.length > 0 && mustPassed === must.length;

  return {
    results,
    mustPassed,
    mustTotal: must.length,
    shouldPassed,
    shouldTotal: should.length,
    allMustPassed,
    eligibleForPaper: allMustPassed,
  };
}
