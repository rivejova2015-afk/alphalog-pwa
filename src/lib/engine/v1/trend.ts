// Per-timeframe trend bias: returns a number in [-100, +100] where the sign
// indicates trend direction (positive = bullish) and the magnitude indicates
// strength derived from the EMA50 slope normalized by ATR(14).
//
// Returns 0 when the bar count is insufficient for stable EMA200 — the caller
// is responsible for weighting these neutral TFs accordingly.

import type { Bar } from "@/types/backtest";
import { ema, atr } from "@/lib/backtest/indicators";

const MIN_BARS = 200;
const SLOPE_LOOKBACK = 20;

export function tfTrendBias(bars: Bar[]): number {
  if (!bars || bars.length < MIN_BARS) return 0;

  const closes = bars.map((b) => b.close);
  const ema50  = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const atrSeries = atr(bars, 14);

  const last = closes.length - 1;
  const e50  = ema50[last];
  const e200 = ema200[last];
  const e50Prev = ema50[last - SLOPE_LOOKBACK];
  const atrLast = atrSeries[last];

  if (!Number.isFinite(e50) || !Number.isFinite(e200) || !Number.isFinite(e50Prev) || !Number.isFinite(atrLast) || atrLast <= 0) {
    return 0;
  }

  const direction = Math.sign(e50 - e200);
  if (direction === 0) return 0;

  // Slope per bar, normalized by ATR. A slope of 1 ATR per SLOPE_LOOKBACK bars
  // maps roughly to bias ~ 50; multiply by direction to get sign.
  const slopePerBar = (e50 - e50Prev) / SLOPE_LOOKBACK;
  const normalized = slopePerBar / atrLast;
  const magnitude = Math.min(100, Math.abs(normalized) * 500);

  return direction * magnitude;
}
