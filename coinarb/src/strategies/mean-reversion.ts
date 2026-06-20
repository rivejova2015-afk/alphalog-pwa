/**
 * Mean-reversion strategy — Phase 3 of the regime-aware multi-strategy
 * restructure.
 *
 * Pure helpers + signal detector. Designed to be invoked when the regime
 * detector (Phase 1) reports RANGE_LOW: low directionality + low vol means
 * SMC liquidity grabs almost never form, but Bollinger Band rejections
 * with RSI extremes do. The strategy expects price to revert to the
 * 1H 20-period EMA (BB middle) as TP.
 *
 * Signal logic:
 *   close < BB_lower(20,2) AND RSI(14) < 30  → BUY
 *   close > BB_upper(20,2) AND RSI(14) > 70  → SELL
 *
 * Targets:
 *   TP = BB middle (current 1H SMA20)
 *   SL = 1.5 × ATR(14) past the touched band
 *   R:R floor = 1.5 (mean-rev wins more often but smaller R per win;
 *                    compensates the SMC 1:2 with frequency)
 *
 * Out of scope (handled by the coordinator, not this module):
 *   - liquidity-sweep gate (irrelevant for mean-rev)
 *   - CHOCH / premium-discount (SMC concepts, not used here)
 *   - arb-gap check (mean-rev is not a latency-arb strategy)
 *   - phase-manager risk sizing (shared across strategies in coordinator)
 *   - circuit-breaker / daily caps (per-strategy in coordinator)
 *   - symbol mutex (cross-strategy in coordinator, Fase 3 PR #36)
 *
 * No DB / IO — pure functions only so the suite can stress all edge cases
 * without mocks. The future `Strategy` class wrapper (Phase 2) just
 * delegates to `detectMeanRevSignal()`.
 */

import type { Candle } from '../analysis/candle-builder.js';

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export interface MeanRevSignal {
  side: 'BUY' | 'SELL' | null;
  entryPrice: number;
  tp: number;
  sl: number;
  rr: number;
  reason: string;
  /** Inputs at decision time, useful for telemetry + post-mortem. */
  meta: {
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
    rsi: number;
    atr: number;
  };
}

export interface MeanRevConfig {
  bbPeriod: number;
  bbStdDev: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
  rrFloor: number;
  slAtrMult: number;
}

/**
 * Defaults calibrated for spot BTC/ETH/SOL 1H + 15M. The BB/RSI
 * combination should produce 30-60 setups per symbol per month on
 * historical chop data; the rrFloor=1.5 filters out the worst of the
 * tight rejections where TP doesn't justify SL.
 */
export const DEFAULT_MEAN_REV_CONFIG: MeanRevConfig = {
  bbPeriod: 20,
  bbStdDev: 2,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  rrFloor: 1.5,
  slAtrMult: 1.5,
};

/**
 * Simple moving average over the last `period` closes.
 * Exported for testing. Returns NaN if `closes.length < period`.
 */
export function sma(closes: number[], period: number): number {
  if (closes.length < period) return NaN;
  let sum = 0;
  for (let i = closes.length - period; i < closes.length; i++) sum += closes[i];
  return sum / period;
}

/**
 * Population standard deviation over the last `period` closes.
 * Exported for testing. Returns NaN if `closes.length < period`.
 */
export function stdev(closes: number[], period: number): number {
  if (closes.length < period) return NaN;
  const mean = sma(closes, period);
  if (!Number.isFinite(mean)) return NaN;
  let sumSq = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / period);
}

/**
 * Bollinger Bands. Middle = SMA, upper/lower = SMA ± stdDev × σ.
 * Returns NaN values if `closes.length < period`.
 */
export function bollingerBands(
  closes: number[],
  period = 20,
  stdDev = 2,
): BollingerBands {
  const middle = sma(closes, period);
  const sigma = stdev(closes, period);
  if (!Number.isFinite(middle) || !Number.isFinite(sigma)) {
    return { upper: NaN, middle: NaN, lower: NaN };
  }
  return {
    middle,
    upper: middle + stdDev * sigma,
    lower: middle - stdDev * sigma,
  };
}

/**
 * RSI (Wilder smoothing) over the last `period + 1` closes.
 * Returns 50 when there's no movement at all (the neutral midpoint).
 * Returns NaN if `closes.length < period + 1`.
 */
export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return NaN;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses += -delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Wilder ATR(period). Returns NaN if `candles.length < period + 1`.
 * Duplicated narrow copy from regime-detector.ts to keep this strategy
 * module self-contained — at coordinator integration time both consumers
 * may dedupe to a shared `coinarb/src/analysis/atr.ts`.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const cur = candles[i];
    const prevClose = candles[i - 1].close;
    const range = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    trSum += range;
  }
  let value = trSum / period;
  for (let i = period + 1; i < candles.length; i++) {
    const cur = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    value = (value * (period - 1) + tr) / period;
  }
  return value;
}

/**
 * Detect a mean-reversion signal on the latest 1H candle.
 *
 * Returns `{ side: null, ... }` whenever the setup conditions don't fire OR
 * the implied R:R falls below `rrFloor`. The reason field always describes
 * the dominant rejection so a decision logger can persist it for SKIP
 * analytics.
 *
 * - `candles1H` powers BB + ATR (last N candles slice internally).
 * - `candles15M` powers RSI confirmation on a faster timeframe — the 1H
 *   close hitting the band combined with 15M RSI extreme is the entry
 *   trigger. Using 1H for RSI is too laggy for mean-rev; using 15M for BB
 *   is too noisy.
 */
export function detectMeanRevSignal(
  candles1H: Candle[],
  candles15M: Candle[],
  cfg: MeanRevConfig = DEFAULT_MEAN_REV_CONFIG,
): MeanRevSignal {
  if (candles1H.length < cfg.bbPeriod + 5 || candles15M.length < cfg.rsiPeriod + 5) {
    return blockedSignal('warming up (insufficient candles)', 0);
  }

  const closes1H = candles1H.map((c) => c.close);
  const closes15M = candles15M.map((c) => c.close);
  const bb = bollingerBands(closes1H, cfg.bbPeriod, cfg.bbStdDev);
  const rsiValue = rsi(closes15M, cfg.rsiPeriod);
  const atrValue = atr(candles1H, 14);

  if (!Number.isFinite(bb.middle) || !Number.isFinite(rsiValue) || !Number.isFinite(atrValue)) {
    return blockedSignal('non-finite indicators', 0);
  }

  const lastClose = closes1H[closes1H.length - 1];
  const meta = {
    bbUpper: bb.upper,
    bbMiddle: bb.middle,
    bbLower: bb.lower,
    rsi: rsiValue,
    atr: atrValue,
  };

  // BUY setup: close pierced lower band + 15M oversold.
  if (lastClose < bb.lower && rsiValue < cfg.rsiOversold) {
    const tp = bb.middle;
    // SL is `slAtrMult × ATR` below the entry. We don't anchor it to the
    // band because a gap-down can put `entry < band - ATR` — in that case
    // anchoring to the band leaves the SL above entry, breaking BUY math.
    const sl = lastClose - cfg.slAtrMult * atrValue;
    const reward = tp - lastClose;
    const risk = lastClose - sl;
    if (risk <= 0 || reward <= 0) {
      return blockedSignal(
        `BUY setup but risk/reward degenerate (reward=${reward.toFixed(2)}, risk=${risk.toFixed(2)})`,
        lastClose,
        meta,
      );
    }
    const rr = reward / risk;
    if (rr < cfg.rrFloor) {
      return blockedSignal(
        `BUY setup rejected by R:R floor (rr=${rr.toFixed(2)} < ${cfg.rrFloor})`,
        lastClose,
        meta,
      );
    }
    return {
      side: 'BUY',
      entryPrice: lastClose,
      tp, sl, rr,
      reason: `BB lower pierced (${lastClose.toFixed(2)} < ${bb.lower.toFixed(2)}) + RSI ${rsiValue.toFixed(1)} oversold`,
      meta,
    };
  }

  // SELL setup: close pierced upper band + 15M overbought.
  if (lastClose > bb.upper && rsiValue > cfg.rsiOverbought) {
    const tp = bb.middle;
    // Symmetric to BUY: anchor SL above entry by ATR, not band-relative.
    const sl = lastClose + cfg.slAtrMult * atrValue;
    const reward = lastClose - tp;
    const risk = sl - lastClose;
    if (risk <= 0 || reward <= 0) {
      return blockedSignal(
        `SELL setup but risk/reward degenerate (reward=${reward.toFixed(2)}, risk=${risk.toFixed(2)})`,
        lastClose,
        meta,
      );
    }
    const rr = reward / risk;
    if (rr < cfg.rrFloor) {
      return blockedSignal(
        `SELL setup rejected by R:R floor (rr=${rr.toFixed(2)} < ${cfg.rrFloor})`,
        lastClose,
        meta,
      );
    }
    return {
      side: 'SELL',
      entryPrice: lastClose,
      tp, sl, rr,
      reason: `BB upper pierced (${lastClose.toFixed(2)} > ${bb.upper.toFixed(2)}) + RSI ${rsiValue.toFixed(1)} overbought`,
      meta,
    };
  }

  return blockedSignal(
    `no setup (close=${lastClose.toFixed(2)} bbBand=[${bb.lower.toFixed(2)},${bb.upper.toFixed(2)}] rsi=${rsiValue.toFixed(1)})`,
    lastClose,
    meta,
  );
}

function blockedSignal(reason: string, entryPrice = 0, meta?: MeanRevSignal['meta']): MeanRevSignal {
  return {
    side: null,
    entryPrice,
    tp: 0,
    sl: 0,
    rr: 0,
    reason,
    meta: meta ?? { bbUpper: NaN, bbMiddle: NaN, bbLower: NaN, rsi: NaN, atr: NaN },
  };
}
