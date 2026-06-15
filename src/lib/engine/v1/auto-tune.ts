// Auto-tune SL/TP ATR grid search (Mejora #6).
//
// Iterates a 2D grid of (slAtrMult × tpAtrMult) combinations and runs the
// engine v1 simulation for each, ranking by Sharpe. Streams per-trial results
// via the onTrial callback so the SSE route can push progress live to the UI.
//
// Skip mode: by default we drop combos where tpAtrMult <= slAtrMult since the
// risk/reward ratio is degenerate (you're risking more than the reward). With
// the default 5×7 grid, this trims ~10 combos → ~25 effective trials.
//
// Baseline-only: each trial runs the engine without Monte Carlo / Walk-Forward
// / advanced pipeline overhead. A baseline backtest is ~1s for 1y M15, so 25
// trials ≈ 25-30s. The user only cares about ranking by Sharpe — robustness
// metrics are evaluated separately on the selected combo.

import type { Bar, BacktestMetrics } from "@/types/backtest";
import { simulateEngineV1, type SimulationOpts } from "./backtest";

export const DEFAULT_SL_RANGE = [1.0, 1.5, 2.0, 2.5, 3.0] as const;
export const DEFAULT_TP_RANGE = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as const;

export interface TuneTrial {
  slAtrMult: number;
  tpAtrMult: number;
  sharpe: number;
  totalPnl: number;
  winRate: number;
  maxDrawdownPct: number;
  trades: number;
  /** 1-indexed position in the grid for streaming progress (e.g. 5/25). */
  index: number;
  /** Total trials the grid will produce (counted after degenerate skip). */
  total: number;
}

export interface AutoTuneOpts {
  /**
   * Base simulation config without the slAtrMult/tpAtrMult fields — those are
   * filled in per-trial. `barsByTf` must already be loaded so we don't pay
   * the network cost per trial.
   */
  baseCfg: Omit<SimulationOpts, "slAtrMult" | "tpAtrMult">;
  slRange?: readonly number[];
  tpRange?: readonly number[];
  /**
   * Drop combos where tp <= sl (R ratio < 1). Default true. Set to false when
   * the caller wants the full cartesian product for diagnostic purposes.
   */
  skipDegenerate?: boolean;
  /**
   * Called after each completed trial. The SSE route uses this to flush an
   * `event: trial` chunk before continuing to the next combo. Must not throw
   * — errors here are swallowed to avoid aborting the whole sweep.
   */
  onTrial?: (trial: TuneTrial) => void;
}

export interface AutoTuneResult {
  trials: TuneTrial[];
  best: TuneTrial;
}

/**
 * Build the (sl, tp) pairs the grid will evaluate. Filters out tp <= sl when
 * skipDegenerate is true. Exported for testability.
 */
export function buildGrid(
  slRange: readonly number[],
  tpRange: readonly number[],
  skipDegenerate: boolean,
): Array<{ sl: number; tp: number }> {
  const pairs: Array<{ sl: number; tp: number }> = [];
  for (const sl of slRange) {
    for (const tp of tpRange) {
      if (skipDegenerate && tp <= sl) continue;
      pairs.push({ sl, tp });
    }
  }
  return pairs;
}

export async function runAutoTune(opts: AutoTuneOpts): Promise<AutoTuneResult> {
  const slRange = opts.slRange ?? DEFAULT_SL_RANGE;
  const tpRange = opts.tpRange ?? DEFAULT_TP_RANGE;
  const skipDegenerate = opts.skipDegenerate !== false;

  const grid = buildGrid(slRange, tpRange, skipDegenerate);
  const total = grid.length;
  const trials: TuneTrial[] = [];

  for (let i = 0; i < grid.length; i++) {
    const { sl, tp } = grid[i];
    const result = await simulateEngineV1({ ...opts.baseCfg, slAtrMult: sl, tpAtrMult: tp });
    const m = result.metrics;
    const trial: TuneTrial = {
      slAtrMult: sl,
      tpAtrMult: tp,
      sharpe: safe(m.sharpe),
      totalPnl: safe(m.totalPnl),
      winRate: safe(m.winRate),
      maxDrawdownPct: safe(m.maxDrawdownPct),
      trades: result.trades.length,
      index: i + 1,
      total,
    };
    trials.push(trial);
    if (opts.onTrial) {
      try { opts.onTrial(trial); } catch { /* swallow — UI streaming shouldn't abort the sweep */ }
    }
  }

  // Best by Sharpe. Tie-breaker: higher totalPnl. If everything is non-finite
  // we fall back to the first trial so the response is well-formed.
  const best = trials.reduce((acc, t) => {
    if (!acc) return t;
    if (t.sharpe > acc.sharpe) return t;
    if (t.sharpe === acc.sharpe && t.totalPnl > acc.totalPnl) return t;
    return acc;
  }, trials[0]);

  return { trials, best };
}

function safe(v: number | undefined): number {
  return v != null && Number.isFinite(v) ? v : 0;
}

// Re-export Bar so consumers can type-check without importing two modules.
export type { Bar };
