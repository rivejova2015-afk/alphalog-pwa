// Average True Range (ATR) computation over a Bar series.
//
// Used by dispatchTradovate to size SL/TP dynamically per contract:
//   slTicks = ATR × sl_atr_mult / tickSize
//   tpTicks = ATR × tp_atr_mult / tickSize
//
// Implementation: standard Wilder ATR.
//   TR_i = max( high_i - low_i,
//               |high_i - close_{i-1}|,
//               |low_i  - close_{i-1}| )
//   ATR_p = simple mean of first `period` TRs (seed)
//   ATR_i = (ATR_{i-1} * (period - 1) + TR_i) / period  (subsequent)
//
// Pure function, no I/O.

import type { Bar } from "@/types/backtest";

/**
 * Compute Wilder ATR over `bars`. Returns ATR in price units (NOT ticks).
 * Returns null when there aren't enough bars to seed (`bars.length <= period`).
 *
 * The result reflects the LAST bar's ATR — the most recent state. For
 * historical ATR series, use computeAtrSeries.
 */
export function computeAtrFromBars(bars: Bar[], period = 14): number | null {
  if (period <= 0 || !Number.isFinite(period)) return null;
  if (!Array.isArray(bars) || bars.length <= period) return null;

  // Step 1: build the TR series (length = bars.length - 1; first bar has no
  // previous close so its TR is undefined).
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const cur  = bars[i];
    const prev = bars[i - 1];
    if (!cur || !prev) continue;
    const a = cur.high - cur.low;
    const b = Math.abs(cur.high - prev.close);
    const c = Math.abs(cur.low  - prev.close);
    const t = Math.max(a, b, c);
    if (!Number.isFinite(t)) return null;
    tr.push(t);
  }
  if (tr.length < period) return null;

  // Step 2: seed ATR = simple mean of first `period` TR values.
  let atr = 0;
  for (let i = 0; i < period; i++) atr += tr[i];
  atr /= period;

  // Step 3: Wilder smoothing over the remaining TRs.
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }

  return Number.isFinite(atr) && atr > 0 ? atr : null;
}
