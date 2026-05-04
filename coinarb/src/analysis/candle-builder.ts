/**
 * Candle builder — folds tick samples into per-timeframe OHLCV candles.
 *
 * Source data: PriceSample[] from coinbase-ws / binance-ws (1h timestamped
 * buffer per asset). We bucket samples into TF windows aligned to UTC, then
 * publish a closed candle once a window rolls over.
 *
 * Volume is NOT available from ticker streams, so candles report v=0 and we
 * rely on volume-delta/volume-profile validators to fetch it from REST when
 * needed.
 */

import type { PriceSample } from '../feeds/coinbase-ws.js';
import type { Timeframe } from '../core/config.js';

export interface Candle {
  timeframe: Timeframe;
  openTs: number;   // ms, aligned to TF bucket start (UTC)
  closeTs: number;  // ms, openTs + bucketMs
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TF_MS: Record<Timeframe, number> = {
  '1D': 86_400_000,
  '4H': 14_400_000,
  '1H':  3_600_000,
  '30M': 1_800_000,
  '15M':   900_000,
  '5M':    300_000,
  '1M':     60_000,
};

/**
 * Build candles from a sample buffer for the requested timeframes.
 * Returns the most recent N closed candles per TF (configurable).
 *
 * Note: with a 1h buffer, you can reliably build ~60 1M candles, ~12 5M,
 * ~4 15M, ~2 30M, ~1 1H, and at most a partial 4H/1D. Higher TFs are
 * intentionally synthesized from the available window — good enough for
 * recency bias, not for backtesting.
 */
export function buildCandles(
  samples: readonly PriceSample[],
  timeframe: Timeframe,
  maxCandles: number = 60,
): Candle[] {
  if (samples.length === 0) return [];
  const bucketMs = TF_MS[timeframe];
  const now = Date.now();
  const earliestBucket = bucketStart(samples[0].timestamp, bucketMs);
  const currentBucket = bucketStart(now, bucketMs);

  const candles: Candle[] = [];
  for (let bucket = earliestBucket; bucket < currentBucket; bucket += bucketMs) {
    const next = bucket + bucketMs;
    const window = samples.filter((s) => s.timestamp >= bucket && s.timestamp < next);
    if (window.length === 0) continue;

    const open = window[0].price;
    const close = window[window.length - 1].price;
    let high = open;
    let low = open;
    for (const s of window) {
      if (s.price > high) high = s.price;
      if (s.price < low) low = s.price;
    }

    candles.push({
      timeframe,
      openTs: bucket,
      closeTs: next,
      open,
      high,
      low,
      close,
      volume: 0,
    });
  }

  return candles.slice(-maxCandles);
}

function bucketStart(ts: number, bucketMs: number): number {
  return Math.floor(ts / bucketMs) * bucketMs;
}

/** Convenience: build all 7 TFs at once */
export function buildAllTimeframes(
  samples: readonly PriceSample[],
  timeframes: readonly Timeframe[],
): Map<Timeframe, Candle[]> {
  const out = new Map<Timeframe, Candle[]>();
  for (const tf of timeframes) {
    out.set(tf, buildCandles(samples, tf));
  }
  return out;
}
