// Auto-populates the 3 Kelly inputs (kelly_win_rate, kelly_avg_win_usd,
// kelly_avg_loss_usd) on an algorithm's `parameters` from a freshly-computed
// BacktestMetrics. Caller decides WHEN (post-backtest, paper-review cron) —
// this helper just figures out WHETHER + HOW.
//
// Rules:
//   - Reject samples below MIN_TRADES (default 30). Below that the win-rate
//     estimate is too noisy to feed into Kelly (which is famously fragile to
//     estimation error).
//   - winRate, avgWin, avgLoss must all be > 0. If avgLoss is 0 (no losing
//     trades in the sample), Kelly is undefined — skip.
//   - Returns null when inputs aren't usable; caller can no-op.
//
// Pure function, no I/O. Vitest covers all branches.

import type { BacktestMetrics } from "@/types/backtest";

export interface KellyInputsPayload {
  kelly_win_rate:           number;   // fractional [0,1]
  kelly_avg_win_usd:        number;
  kelly_avg_loss_usd:       number;
  kelly_inputs_updated_at:  string;   // ISO timestamp
  kelly_inputs_source:      string;   // e.g. "engine_backtest:<run_id>"
  kelly_inputs_sample_size: number;   // totalTrades
}

export const KELLY_MIN_SAMPLE_TRADES = 30;

export interface AutoPopulateOptions {
  /** Source tag for forensic queries — e.g. "engine_backtest:run-uuid". */
  sourceTag: string;
  /** Timestamp captured by the caller (avoids Date.now() in pure helper). */
  nowIso: string;
  /** Override the trade-count floor. Default 30. */
  minTrades?: number;
}

export function buildKellyInputs(
  metrics: BacktestMetrics,
  opts: AutoPopulateOptions,
): KellyInputsPayload | null {
  const minTrades = opts.minTrades ?? KELLY_MIN_SAMPLE_TRADES;

  if (metrics.totalTrades < minTrades) return null;
  if (!Number.isFinite(metrics.winRate) || metrics.winRate <= 0 || metrics.winRate >= 1) return null;
  if (!Number.isFinite(metrics.avgWin)  || metrics.avgWin  <= 0) return null;
  if (!Number.isFinite(metrics.avgLoss) || metrics.avgLoss <= 0) return null;

  return {
    kelly_win_rate:           metrics.winRate,
    kelly_avg_win_usd:        metrics.avgWin,
    kelly_avg_loss_usd:       metrics.avgLoss,
    kelly_inputs_updated_at:  opts.nowIso,
    kelly_inputs_source:      opts.sourceTag,
    kelly_inputs_sample_size: metrics.totalTrades,
  };
}

/**
 * Merge a Kelly payload into an existing `parameters` jsonb without disturbing
 * unrelated keys (kelly_enabled, kelly_fraction, kelly_min/max_contracts,
 * contracts_per_trade, ATR mults, cme_account_id, etc.).
 *
 * Caller is responsible for the actual UPDATE — this function returns the new
 * object to persist.
 */
export function mergeKellyInputs(
  existing: Record<string, unknown> | null | undefined,
  payload: KellyInputsPayload,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...payload,
  };
}
