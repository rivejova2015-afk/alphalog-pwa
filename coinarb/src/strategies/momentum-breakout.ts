/**
 * Momentum-breakout strategy — Phase 4 of the regime-aware multi-strategy
 * restructure.
 *
 * Pure helpers + signal detector. Designed for the TRENDING_LOW regime —
 * clean directionality with low chop. In TRENDING_HIGH the SMC aggressive
 * pipeline (PR #36) handles entries; in TRENDING_LOW SMC's liquidity grabs
 * are too rare because vol is below median. Momentum-breakout catches the
 * grind-up / grind-down structures instead.
 *
 * Signal logic:
 *   EMA20 > EMA50 (bullish stack) AND ADX(14) > 25 AND
 *     volume(last 5 candles) > avg(last 20) × 1.3                   → BUY
 *   EMA20 < EMA50 (bearish stack) AND ADX(14) > 25 AND
 *     volume(last 5 candles) > avg(last 20) × 1.3                   → SELL
 *
 * Targets:
 *   TP = entry ± 2 × ATR(14)
 *   SL = swing-low (BUY) or swing-high (SELL) over last `swingLookback`
 *        bars, with `slBufferAtrMult × ATR` extra distance.
 *   R:R floor = 2.0 (we expect 1:2 since TP is 2 × ATR; if swing is too
 *                    far we abort rather than enter a poor risk profile)
 *
 * Out of scope (handled by coordinator):
 *   - liquidity-sweep, CHOCH, premium-discount (SMC)
 *   - arb-gap (momentum is not a latency-arb strategy)
 *   - phase-manager risk sizing, circuit-breaker, daily cap, mutex
 *
 * Pure functions only. No DB / IO. The Phase 2 wrapper just delegates.
 */

import type { Candle } from '../analysis/candle-builder.js';

export interface MomentumSignal {
  side: 'BUY' | 'SELL' | null;
  entryPrice: number;
  tp: number;
  sl: number;
  rr: number;
  reason: string;
  meta: {
    ema20: number;
    ema50: number;
    adx: number;
    volRatio: number;
    atr: number;
    swingLow: number;
    swingHigh: number;
  };
}

export interface MomentumConfig {
  emaFast: number;
  emaSlow: number;
  adxPeriod: number;
  adxFloor: number;
  volWindow: number;
  volBaseline: number;
  volRatioFloor: number;
  swingLookback: number;
  tpAtrMult: number;
  slBufferAtrMult: number;
  rrFloor: number;
}

/**
 * Defaults calibrated for spot BTC/ETH/SOL on 5M candles. ADX floor 25 is
 * the textbook "trending" threshold; vol ratio 1.3 filters out flat-volume
 * grinds where breakouts are likely to fail. tpAtrMult=2 gives a 1:2 R:R
 * with slBufferAtrMult=0.5 (swing + 0.5×ATR buffer).
 */
export const DEFAULT_MOMENTUM_CONFIG: MomentumConfig = {
  emaFast: 20,
  emaSlow: 50,
  adxPeriod: 14,
  adxFloor: 25,
  volWindow: 5,
  volBaseline: 20,
  volRatioFloor: 1.3,
  swingLookback: 10,
  tpAtrMult: 2,
  slBufferAtrMult: 0.5,
  rrFloor: 2.0,
};

/**
 * Exponential Moving Average over the last `period` values.
 * Seeded with the SMA of the first `period` values, then standard EMA
 * smoothing. Returns NaN if `values.length < period`.
 */
export function ema(values: number[], period: number): number {
  if (values.length < period) return NaN;
  const k = 2 / (period + 1);
  let emaValue = 0;
  for (let i = 0; i < period; i++) emaValue += values[i];
  emaValue /= period;
  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

/**
 * Wilder ATR(period). Returns NaN if `candles.length < period + 1`.
 * Local copy to keep this strategy self-contained.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  const tr = (prev: number, c: Candle): number =>
    Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));

  let trSum = 0;
  for (let i = 1; i <= period; i++) trSum += tr(candles[i - 1].close, candles[i]);
  let value = trSum / period;
  for (let i = period + 1; i < candles.length; i++) {
    value = (value * (period - 1) + tr(candles[i - 1].close, candles[i])) / period;
  }
  return value;
}

/**
 * Wilder ADX(period). 0–100. NaN if `candles.length < 2 × period + 1`.
 * Local copy from regime-detector for self-containment.
 */
export function adx(candles: Candle[], period = 14): number {
  if (candles.length < period * 2 + 1) return NaN;

  const trArr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trArr.push(tr);
    const up = cur.high - prev.high;
    const down = prev.low - cur.low;
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
  }

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

  const trS = smooth(trArr);
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
 * Ratio of average volume of last `window` candles vs last `baseline`
 * candles. Returns 0 if either window has no candles or the baseline
 * average is 0 (which happens on candles from ticker streams that don't
 * emit volume — see candle-builder.ts comment).
 */
export function volumeRatio(candles: Candle[], window: number, baseline: number): number {
  if (candles.length < baseline) return 0;
  const recent = candles.slice(-window);
  const wide = candles.slice(-baseline);
  if (recent.length === 0 || wide.length === 0) return 0;
  const recentAvg = recent.reduce((s, c) => s + c.volume, 0) / recent.length;
  const wideAvg = wide.reduce((s, c) => s + c.volume, 0) / wide.length;
  if (wideAvg === 0) return 0;
  return recentAvg / wideAvg;
}

/**
 * Lowest low and highest high over the last `lookback` candles. Used as
 * SL anchors for momentum entries.
 */
export function swingPoints(candles: Candle[], lookback: number): { low: number; high: number } {
  const slice = candles.slice(-lookback);
  let low = Infinity;
  let high = -Infinity;
  for (const c of slice) {
    if (c.low < low) low = c.low;
    if (c.high > high) high = c.high;
  }
  return { low, high };
}

/**
 * Detect a momentum-breakout signal on the latest candle of the input
 * stream. Returns `{ side: null, ... }` whenever the setup conditions
 * don't fire OR the implied R:R falls below `rrFloor`. The reason field
 * describes why we skipped.
 *
 * The input is a single timeframe (typically 5M for spot crypto). All
 * indicators (EMA, ADX, ATR, volume ratio, swings) are computed on that
 * one timeframe — keeping it single-TF makes the strategy faster to
 * reason about and easier to backtest.
 */
export function detectMomentumSignal(
  candles: Candle[],
  cfg: MomentumConfig = DEFAULT_MOMENTUM_CONFIG,
): MomentumSignal {
  const need = Math.max(cfg.emaSlow + 5, cfg.adxPeriod * 2 + 1, cfg.volBaseline + 1);
  if (candles.length < need) {
    return blockedSignal(`warming up (need ${need} candles, have ${candles.length})`);
  }

  const closes = candles.map((c) => c.close);
  const emaFast = ema(closes, cfg.emaFast);
  const emaSlow = ema(closes, cfg.emaSlow);
  const adxValue = adx(candles, cfg.adxPeriod);
  const atrValue = atr(candles, 14);
  const volRatio = volumeRatio(candles, cfg.volWindow, cfg.volBaseline);
  const swings = swingPoints(candles, cfg.swingLookback);

  const lastClose = closes[closes.length - 1];
  const meta = {
    ema20: emaFast,
    ema50: emaSlow,
    adx: adxValue,
    volRatio,
    atr: atrValue,
    swingLow: swings.low,
    swingHigh: swings.high,
  };

  if (
    !Number.isFinite(emaFast) ||
    !Number.isFinite(emaSlow) ||
    !Number.isFinite(adxValue) ||
    !Number.isFinite(atrValue)
  ) {
    return blockedSignal('non-finite indicators', lastClose, meta);
  }

  if (adxValue < cfg.adxFloor) {
    return blockedSignal(
      `adx=${adxValue.toFixed(1)} below floor (${cfg.adxFloor})`,
      lastClose,
      meta,
    );
  }
  // Note: when candle-builder.ts reports volume=0 (ticker streams), volRatio
  // is 0 and we skip. This is correct — without volume confirmation a
  // momentum entry on a thin grind is exactly what we want to filter.
  if (volRatio < cfg.volRatioFloor) {
    return blockedSignal(
      `vol ratio ${volRatio.toFixed(2)} below floor (${cfg.volRatioFloor})`,
      lastClose,
      meta,
    );
  }

  // EMA stack determines direction. Cross-back-and-forth chop is excluded
  // implicitly by the ADX floor (chop ⇒ low ADX).
  if (emaFast > emaSlow) {
    const tp = lastClose + cfg.tpAtrMult * atrValue;
    // SL is the *closer* of swing-low (with ATR buffer) or entry-anchored
    // 1×ATR. On strict trends the swing is far below the current close, so
    // entry-anchored SL keeps risk reasonable; on choppier setups the
    // swing-based SL is wider but more structurally sound. Math.max picks
    // the higher value, which is closer to entry for a BUY (smaller risk).
    const sl = Math.max(swings.low - cfg.slBufferAtrMult * atrValue, lastClose - atrValue);
    const reward = tp - lastClose;
    const risk = lastClose - sl;
    if (risk <= 0 || reward <= 0) {
      return blockedSignal(
        `BUY math degenerate (reward=${reward.toFixed(2)}, risk=${risk.toFixed(2)})`,
        lastClose,
        meta,
      );
    }
    const rr = reward / risk;
    if (rr < cfg.rrFloor) {
      return blockedSignal(
        `BUY rejected by R:R floor (rr=${rr.toFixed(2)} < ${cfg.rrFloor})`,
        lastClose,
        meta,
      );
    }
    return {
      side: 'BUY',
      entryPrice: lastClose,
      tp, sl, rr,
      reason:
        `EMA${cfg.emaFast}=${emaFast.toFixed(2)} > EMA${cfg.emaSlow}=${emaSlow.toFixed(2)}, ` +
        `adx=${adxValue.toFixed(1)}, volRatio=${volRatio.toFixed(2)}`,
      meta,
    };
  }

  if (emaFast < emaSlow) {
    const tp = lastClose - cfg.tpAtrMult * atrValue;
    // Symmetric to BUY: closer of swing-high (buffered) or entry + 1×ATR.
    // For a SELL the closer SL is the *lower* value.
    const sl = Math.min(swings.high + cfg.slBufferAtrMult * atrValue, lastClose + atrValue);
    const reward = lastClose - tp;
    const risk = sl - lastClose;
    if (risk <= 0 || reward <= 0) {
      return blockedSignal(
        `SELL math degenerate (reward=${reward.toFixed(2)}, risk=${risk.toFixed(2)})`,
        lastClose,
        meta,
      );
    }
    const rr = reward / risk;
    if (rr < cfg.rrFloor) {
      return blockedSignal(
        `SELL rejected by R:R floor (rr=${rr.toFixed(2)} < ${cfg.rrFloor})`,
        lastClose,
        meta,
      );
    }
    return {
      side: 'SELL',
      entryPrice: lastClose,
      tp, sl, rr,
      reason:
        `EMA${cfg.emaFast}=${emaFast.toFixed(2)} < EMA${cfg.emaSlow}=${emaSlow.toFixed(2)}, ` +
        `adx=${adxValue.toFixed(1)}, volRatio=${volRatio.toFixed(2)}`,
      meta,
    };
  }

  return blockedSignal(`EMAs converged (${emaFast.toFixed(2)} = ${emaSlow.toFixed(2)})`, lastClose, meta);
}

function blockedSignal(reason: string, entryPrice = 0, meta?: MomentumSignal['meta']): MomentumSignal {
  return {
    side: null,
    entryPrice,
    tp: 0,
    sl: 0,
    rr: 0,
    reason,
    meta: meta ?? {
      ema20: NaN, ema50: NaN, adx: NaN, volRatio: NaN, atr: NaN,
      swingLow: NaN, swingHigh: NaN,
    },
  };
}
