/**
 * Market regime detector.
 *
 * Classifies the current market state into one of 5 regimes using volatility
 * (ATR normalized against a rolling 30-day baseline) and directionality
 * (Wilder's ADX). The coordinator (Phase 2) uses the result to pick which
 * strategy runs:
 *
 *   TRENDING_HIGH  → SMC aggressive — the SMC pipeline most likely to see
 *                    clean liquidity grabs when both trend and vol are present
 *   TRENDING_LOW   → momentum-breakout — clean direction with low chop
 *   RANGE_HIGH     → SMC strict — volatility gives EQH/EQL structural
 *                    definition even without trend
 *   RANGE_LOW      → mean-reversion — Bollinger + RSI extremes in tight range
 *   DEAD           → pause entries entirely — no actionable market
 *
 * The classifier is **stateless**. Callers wanting hysteresis pass the
 * previous regime via `hysteresisHint` so the transition zone (mid ADX +
 * mid vol) sticks with the prior regime instead of flapping.
 *
 * Calibration baseline: BTC/ETH/SOL on Coinbase spot, 1H candles. Symbols
 * with materially different baseline vol must override thresholds via the
 * `regime_config` block in `algorithms.parameters` (loaded by config.ts at
 * boot, Fase B).
 */

import type { Candle } from './candle-builder.js';

export type Regime = 'TRENDING_HIGH' | 'TRENDING_LOW' | 'RANGE_HIGH' | 'RANGE_LOW' | 'DEAD';

export interface RegimeResult {
  regime: Regime;
  /** 0–1. Agreement strength between the ADX and ATR signals. */
  confidence: number;
  /** Current ATR(14) divided by the median ATR(14) over the baseline window. */
  atrNorm: number;
  /** Wilder ADX(14), 0–100. */
  adx: number;
  /** Human-readable explanation for telemetry/logs. */
  reason: string;
}

export interface RegimeThresholds {
  atrLowVol: number;
  atrHighVol: number;
  atrDead: number;
  adxRange: number;
  adxTrending: number;
  baselineCandlesMin: number;
}

/**
 * Defaults calibrated on 30d of BTC-USD/ETH-USD/SOL-USD 1H candles
 * (2026-05 to 2026-06). Bands chosen so that historical chop periods
 * land in RANGE_LOW, NY session opens in TRENDING_HIGH, etc.
 */
export const DEFAULT_THRESHOLDS: RegimeThresholds = {
  atrLowVol: 0.7,
  atrHighVol: 1.4,
  atrDead: 0.4,
  adxRange: 20,
  adxTrending: 25,
  baselineCandlesMin: 200,
};

/**
 * True Range of a candle vs the previous close (Wilder).
 *   TR = max(high-low, |high-prevClose|, |low-prevClose|)
 * Exported for unit testing.
 */
export function trueRange(prevClose: number, candle: Candle): number {
  const a = candle.high - candle.low;
  const b = Math.abs(candle.high - prevClose);
  const c = Math.abs(candle.low - prevClose);
  return Math.max(a, b, c);
}

/**
 * Average True Range over `period` candles, Wilder smoothing.
 * Returns NaN if there are < period + 1 candles.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    trSum += trueRange(candles[i - 1].close, candles[i]);
  }
  let value = trSum / period;
  for (let i = period + 1; i < candles.length; i++) {
    const tr = trueRange(candles[i - 1].close, candles[i]);
    value = (value * (period - 1) + tr) / period;
  }
  return value;
}

/**
 * Current ATR(period) over the median of a rolling baseline window.
 * Samples ATR at strided positions across the baseline to estimate
 * the typical vol — the comparison is "is right-now vol unusual?".
 * Returns NaN if the input is too short to compute a stable median.
 */
export function atrNormalized(candles: Candle[], period = 14, baselineMin = 200): number {
  if (candles.length < baselineMin) return NaN;
  const current = atr(candles, period);
  if (!Number.isFinite(current)) return NaN;

  const samples: number[] = [];
  const stride = Math.max(period + 1, Math.floor(baselineMin / 50));
  for (let i = period + 1; i < candles.length - period; i += stride) {
    const slice = candles.slice(Math.max(0, i - period - 1), i + period);
    const sample = atr(slice, period);
    if (Number.isFinite(sample)) samples.push(sample);
  }
  if (samples.length < 5) return NaN;
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  // A dead-flat baseline collapses both current and median to 0. That's not
  // a numerical error — it's exactly the "no market" condition the classifier
  // needs to flag as DEAD. Surface it as atrNorm=0 so the caller hits the
  // atrDead branch instead of the NaN insufficient-data branch.
  if (median === 0) return current === 0 ? 0 : NaN;
  return current / median;
}

/**
 * Wilder's ADX(14). 0–100; readings above 25 indicate a directional
 * market, below 20 a range. Returns NaN if there are < 2*period + 1
 * candles available.
 */
export function adx(candles: Candle[], period = 14): number {
  if (candles.length < period * 2 + 1) return NaN;

  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    tr.push(trueRange(prev.close, cur));
    const up = cur.high - prev.high;
    const down = prev.low - cur.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }

  // Wilder smoothing.
  const smooth = (arr: number[]): number[] => {
    const out: number[] = [];
    let prev = arr.slice(0, period).reduce((a, b) => a + b, 0);
    out.push(prev);
    for (let i = period; i < arr.length; i++) {
      prev = prev - prev / period + arr[i];
      out.push(prev);
    }
    return out;
  };
  const trS = smooth(tr);
  const plusDmS = smooth(plusDm);
  const minusDmS = smooth(minusDm);

  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    if (trS[i] === 0) { dx.push(0); continue; }
    const plusDi = 100 * plusDmS[i] / trS[i];
    const minusDi = 100 * minusDmS[i] / trS[i];
    const sum = plusDi + minusDi;
    dx.push(sum === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / sum);
  }

  if (dx.length < period) return NaN;
  let value = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    value = (value * (period - 1) + dx[i]) / period;
  }
  return value;
}

/**
 * Classify the current market regime from a single 1H candle stream.
 *
 * Logic:
 *   atrNorm < atrDead                     → DEAD (no market)
 *   adx > adxTrending  & atrNorm > high   → TRENDING_HIGH
 *   adx > adxTrending  & atrNorm < low    → TRENDING_LOW
 *   adx < adxRange     & atrNorm > high   → RANGE_HIGH
 *   adx < adxRange     & atrNorm < low    → RANGE_LOW
 *   otherwise (transition)                → hysteresisHint or RANGE_HIGH
 *
 * `confidence` reflects how cleanly both axes land at their extremes.
 */
export function classifyRegime(
  candles1H: Candle[],
  thresholds: RegimeThresholds = DEFAULT_THRESHOLDS,
  hysteresisHint?: Regime,
): RegimeResult {
  const atrNorm = atrNormalized(candles1H, 14, thresholds.baselineCandlesMin);
  const adxValue = adx(candles1H, 14);

  if (!Number.isFinite(atrNorm) || !Number.isFinite(adxValue)) {
    return {
      regime: hysteresisHint ?? 'DEAD',
      confidence: 0,
      atrNorm: Number.isFinite(atrNorm) ? atrNorm : 0,
      adx: Number.isFinite(adxValue) ? adxValue : 0,
      reason: `insufficient candles for atr/adx (have ${candles1H.length})`,
    };
  }

  if (atrNorm < thresholds.atrDead) {
    return {
      regime: 'DEAD',
      confidence: 0.9,
      atrNorm, adx: adxValue,
      reason: `vol dead (atrNorm=${atrNorm.toFixed(2)} < ${thresholds.atrDead})`,
    };
  }

  const isRange    = adxValue < thresholds.adxRange;
  const isTrending = adxValue > thresholds.adxTrending;
  const isHighVol  = atrNorm > thresholds.atrHighVol;
  const isLowVol   = atrNorm < thresholds.atrLowVol;

  const adxExtreme = isRange || isTrending;
  const volExtreme = isHighVol || isLowVol;
  const confidence = adxExtreme && volExtreme ? 0.9
                   : adxExtreme || volExtreme ? 0.6
                   : 0.4;

  let regime: Regime;
  let reason: string;
  if (isTrending && isHighVol) {
    regime = 'TRENDING_HIGH';
    reason = `adx=${adxValue.toFixed(1)} (trending) + atrNorm=${atrNorm.toFixed(2)} (high vol)`;
  } else if (isTrending && isLowVol) {
    regime = 'TRENDING_LOW';
    reason = `adx=${adxValue.toFixed(1)} (trending) + atrNorm=${atrNorm.toFixed(2)} (low vol)`;
  } else if (isRange && isHighVol) {
    regime = 'RANGE_HIGH';
    reason = `adx=${adxValue.toFixed(1)} (range) + atrNorm=${atrNorm.toFixed(2)} (high vol)`;
  } else if (isRange && isLowVol) {
    regime = 'RANGE_LOW';
    reason = `adx=${adxValue.toFixed(1)} (range) + atrNorm=${atrNorm.toFixed(2)} (low vol)`;
  } else {
    regime = hysteresisHint ?? 'RANGE_HIGH';
    reason = `transition (adx=${adxValue.toFixed(1)}, atrNorm=${atrNorm.toFixed(2)}) → ${regime}`;
  }

  return { regime, confidence, atrNorm, adx: adxValue, reason };
}
