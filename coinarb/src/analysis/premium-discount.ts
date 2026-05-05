/**
 * Premium / Discount filter (Smart Money 50% equilibrium).
 *
 * Computes the recent swing range (high to low) from a candle window, then
 * splits it into a PREMIUM half (above midpoint) and DISCOUNT half (below).
 * The bot only takes BUYs in DISCOUNT and SELLs in PREMIUM — institutional
 * "buy low, sell high" rule.
 *
 * Also exposes the OTE (Optimal Trade Entry) band: the 0.62-0.79 fib
 * retracement of the leg, which is the highest-quality entry zone within
 * the discount/premium half.
 */

import type { Candle } from './candle-builder.js';

export type PremiumDiscountZone = 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';

export interface PremiumDiscount {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  zone: PremiumDiscountZone;
  ote: { upper: number; lower: number };  // 0.62-0.79 retracement of the leg
}

const EQUILIBRIUM_TOLERANCE = 0.001;  // ±0.1% around midpoint = EQUILIBRIUM

export function computePremiumDiscount(
  candles: Candle[],
  currentPrice: number,
): PremiumDiscount | null {
  if (candles.length < 10) return null;

  const window = candles.slice(-50);
  let rangeHigh = -Infinity;
  let rangeLow = Infinity;
  for (const c of window) {
    if (c.high > rangeHigh) rangeHigh = c.high;
    if (c.low < rangeLow) rangeLow = c.low;
  }

  if (!Number.isFinite(rangeHigh) || !Number.isFinite(rangeLow) || rangeHigh <= rangeLow) {
    return null;
  }

  const equilibrium = (rangeHigh + rangeLow) / 2;
  const range = rangeHigh - rangeLow;

  let zone: PremiumDiscountZone;
  const distFromEq = Math.abs(currentPrice - equilibrium) / equilibrium;
  if (distFromEq < EQUILIBRIUM_TOLERANCE) {
    zone = 'EQUILIBRIUM';
  } else if (currentPrice > equilibrium) {
    zone = 'PREMIUM';
  } else {
    zone = 'DISCOUNT';
  }

  // OTE band: 0.62-0.79 retracement from the swing extreme into the range
  // For DISCOUNT (buying), measured from the high downward
  // For PREMIUM (selling), measured from the low upward
  const ote = zone === 'PREMIUM'
    ? { lower: rangeLow + range * 0.62, upper: rangeLow + range * 0.79 }
    : { lower: rangeHigh - range * 0.79, upper: rangeHigh - range * 0.62 };

  return { rangeHigh, rangeLow, equilibrium, zone, ote };
}

export function isInOte(price: number, pd: PremiumDiscount): boolean {
  return price >= pd.ote.lower && price <= pd.ote.upper;
}
