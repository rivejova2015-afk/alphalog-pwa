// Average True Range (ATR) computation over a Bar series.
//
// Used by dispatchTradovate to size SL/TP dynamically per contract:
//   slTicks = ATR × sl_atr_mult / tickSize
//   tpTicks = ATR × tp_atr_mult / tickSize
//
// Delegates the actual Wilder ATR math to src/lib/backtest/indicators.ts's
// `atr()` (Wave 3 item 10 — this file used to reimplement the same Wilder
// formula independently; deduped since the two were mathematically
// identical, just different input/output shapes: indicators.ts returns the
// full per-bar series, this wrapper only needs the last value).
//
// Pure function, no I/O.

import type { Bar } from "@/types/backtest";
import { atr as atrSeries } from "@/lib/backtest/indicators";

/**
 * Compute Wilder ATR over `bars`. Returns ATR in price units (NOT ticks).
 * Returns null when there aren't enough bars to seed (`bars.length <= period`),
 * when `period` is invalid, or when the computed value is non-finite/non-positive
 * (e.g. a corrupted bar produced a NaN TR).
 *
 * The result reflects the LAST bar's ATR — the most recent state. For the
 * full historical series, call `atr()` from lib/backtest/indicators.ts directly.
 */
export function computeAtrFromBars(bars: Bar[], period = 14): number | null {
  if (period <= 0 || !Number.isFinite(period)) return null;
  if (!Array.isArray(bars) || bars.length <= period) return null;

  const series = atrSeries(bars, period);
  const last = series[series.length - 1];
  return Number.isFinite(last) && last > 0 ? last : null;
}
