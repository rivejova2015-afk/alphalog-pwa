/**
 * Liquidity-grab + rejection wick detector.
 *
 * Pattern: price sweeps a known liquidity pool (EQH/EQL cluster), triggering
 * resting stop orders, then immediately reverses on a strong rejection wick.
 * This is the canonical institutional stop-hunt — entries placed on the
 * reversal candle close ride the reversal back into the range.
 *
 *   BUY_GRAB  : low pierces EQL (low < zone.priceLow)
 *               but close reclaims above it (close > zone.priceHigh)
 *               and lower wick is ≥ 60% of candle range
 *
 *   SELL_GRAB : high pierces EQH (high > zone.priceHigh)
 *               but close rejects below it (close < zone.priceLow)
 *               and upper wick is ≥ 60% of candle range
 *
 * Confidence rolls up rejection wick depth + zone strength (touches).
 */

import type { Candle } from './candle-builder.js';
import type { SmcZone } from './smc-detector.js';

export type GrabType = 'BUY_GRAB' | 'SELL_GRAB';

export interface LiquidityGrab {
  type: GrabType;
  sweptLevel: number;
  rejectionCandle: Candle;
  rejectionPct: number;     // wick fraction of candle range (0-1)
  confidence: number;       // 0-1
  zone: SmcZone;
  formedAt: number;         // ms
}

const MIN_REJECTION_PCT = 0.60;
const LOOKBACK_CANDLES = 3;

export function detectLiquidityGrab(
  candles: Candle[],
  zones: readonly SmcZone[],
): LiquidityGrab | null {
  if (candles.length < 2 || zones.length === 0) return null;

  const eqlZones = zones.filter((z) => z.type === 'EQL');
  const eqhZones = zones.filter((z) => z.type === 'EQH');
  if (eqlZones.length === 0 && eqhZones.length === 0) return null;

  const window = candles.slice(-LOOKBACK_CANDLES);

  // Iterate newest → oldest in the window, return first valid grab
  for (let i = window.length - 1; i >= 0; i--) {
    const c = window[i];
    const range = c.high - c.low;
    if (range <= 0) continue;

    // BUY_GRAB: swept an EQL
    for (const zone of eqlZones) {
      if (c.low < zone.priceLow && c.close > zone.priceHigh) {
        const wickPct = (c.close - c.low) / range;
        if (wickPct >= MIN_REJECTION_PCT) {
          return {
            type: 'BUY_GRAB',
            sweptLevel: zone.priceLow,
            rejectionCandle: c,
            rejectionPct: wickPct,
            confidence: scoreGrab(wickPct, eqlZones.length),
            zone,
            formedAt: c.openTs,
          };
        }
      }
    }

    // SELL_GRAB: swept an EQH
    for (const zone of eqhZones) {
      if (c.high > zone.priceHigh && c.close < zone.priceLow) {
        const wickPct = (c.high - c.close) / range;
        if (wickPct >= MIN_REJECTION_PCT) {
          return {
            type: 'SELL_GRAB',
            sweptLevel: zone.priceHigh,
            rejectionCandle: c,
            rejectionPct: wickPct,
            confidence: scoreGrab(wickPct, eqhZones.length),
            zone,
            formedAt: c.openTs,
          };
        }
      }
    }
  }

  return null;
}

function scoreGrab(wickPct: number, zoneCount: number): number {
  // Base = wick depth (0.6-1.0 mapped to 0.5-0.85)
  const wickScore = 0.5 + ((wickPct - MIN_REJECTION_PCT) / (1 - MIN_REJECTION_PCT)) * 0.35;
  // Bonus for cluster strength (more touches = stronger pool of liquidity)
  const zoneBonus = Math.min(zoneCount * 0.03, 0.15);
  return Math.min(wickScore + zoneBonus, 1);
}

/**
 * Stop-loss price for a grab entry — placed just beyond the swept wick.
 */
export function stopForGrab(grab: LiquidityGrab, bufferPct = 0.001): number {
  if (grab.type === 'BUY_GRAB') {
    return grab.rejectionCandle.low * (1 - bufferPct);
  }
  return grab.rejectionCandle.high * (1 + bufferPct);
}
