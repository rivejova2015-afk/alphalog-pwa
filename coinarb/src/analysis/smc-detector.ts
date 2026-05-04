/**
 * Smart Money Concepts detector.
 *
 * Scans an OHLC sequence for the structural patterns the loop trades against:
 *   - BOS (Break of Structure): price closes beyond the prior swing high/low
 *   - CHOCH (Change of Character): BOS in opposite direction of current trend
 *   - OB (Order Block): the last opposing candle before a strong impulse
 *   - FVG (Fair Value Gap): 3-candle gap where candle1.high < candle3.low (bull)
 *   - EQH/EQL (Equal High/Low): liquidity pools where wicks cluster within a band
 *
 * Output `bias` is the directional read: BUY = bullish structure, SELL =
 * bearish, NEUTRAL = unclear or transitioning. Confidence rolls up across
 * the patterns present.
 */

import type { Candle } from './candle-builder.js';

export type SmcBias = 'BUY' | 'SELL' | 'NEUTRAL';
export type SmcZoneType = 'OB-bull' | 'OB-bear' | 'FVG-bull' | 'FVG-bear' | 'EQH' | 'EQL';

export interface SmcZone {
  type: SmcZoneType;
  priceLow: number;
  priceHigh: number;
  formedAt: number; // ms
}

export interface SmcSignal {
  bias: SmcBias;
  confidence: number;       // 0-1
  bos: boolean;             // structural break
  choch: boolean;           // change of character
  zones: SmcZone[];         // most recent OBs/FVGs/EQs
  swingHigh: number | null;
  swingLow: number | null;
}

const SWING_LOOKBACK = 5;
const FVG_MIN_GAP_PCT = 0.0005;     // 0.05% min gap for FVG
const EQH_TOLERANCE_PCT = 0.0008;   // 0.08% wick clustering tolerance
const IMPULSE_BODY_MULT = 1.5;      // OB anchor: impulse body >= 1.5x avg

export function detectSmc(candles: Candle[]): SmcSignal {
  if (candles.length < SWING_LOOKBACK * 2 + 3) {
    return { bias: 'NEUTRAL', confidence: 0, bos: false, choch: false, zones: [], swingHigh: null, swingLow: null };
  }

  const swings = findSwings(candles, SWING_LOOKBACK);
  const lastSwingHigh = lastOf(swings.highs);
  const lastSwingLow = lastOf(swings.lows);
  const lastClose = candles[candles.length - 1].close;

  // BOS: close beyond the most recent opposing swing
  let bos = false;
  let bias: SmcBias = 'NEUTRAL';
  if (lastSwingHigh !== null && lastClose > lastSwingHigh) { bos = true; bias = 'BUY'; }
  else if (lastSwingLow !== null && lastClose < lastSwingLow) { bos = true; bias = 'SELL'; }

  // CHOCH: BOS that reverses the prior trend (very simplified — compare to slope of last 20 closes)
  const choch = bos && isCharacterChange(candles, bias);

  const zones = [
    ...findOrderBlocks(candles),
    ...findFairValueGaps(candles),
    ...findEqualWicks(candles),
  ].slice(-12);

  // Confidence: BOS=+0.4, CHOCH=+0.2, +0.05 per fresh zone (capped)
  let confidence = 0;
  if (bos) confidence += 0.4;
  if (choch) confidence += 0.2;
  confidence += Math.min(zones.length * 0.05, 0.4);
  confidence = Math.min(confidence, 1);

  if (bias === 'NEUTRAL' && zones.length > 0) {
    const bullZones = zones.filter((z) => z.type.endsWith('bull') || z.type === 'EQL').length;
    const bearZones = zones.length - bullZones;
    if (bullZones > bearZones * 1.5) bias = 'BUY';
    else if (bearZones > bullZones * 1.5) bias = 'SELL';
  }

  return {
    bias,
    confidence,
    bos,
    choch,
    zones,
    swingHigh: lastSwingHigh,
    swingLow: lastSwingLow,
  };
}

function findSwings(candles: Candle[], lookback: number): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isSwingHigh = false;
      if (candles[j].low <= c.low) isSwingLow = false;
    }
    if (isSwingHigh) highs.push(c.high);
    if (isSwingLow) lows.push(c.low);
  }
  return { highs, lows };
}

function isCharacterChange(candles: Candle[], newBias: SmcBias): boolean {
  const window = candles.slice(-20);
  if (window.length < 2) return false;
  const slope = window[window.length - 1].close - window[0].close;
  if (newBias === 'BUY' && slope < 0) return true;
  if (newBias === 'SELL' && slope > 0) return true;
  return false;
}

function findOrderBlocks(candles: Candle[]): SmcZone[] {
  const out: SmcZone[] = [];
  const avgBody = candles.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / candles.length;
  for (let i = 1; i < candles.length - 1; i++) {
    const c = candles[i];
    const next = candles[i + 1];
    const nextBody = Math.abs(next.close - next.open);
    if (nextBody < avgBody * IMPULSE_BODY_MULT) continue;

    if (next.close > next.open && c.close < c.open) {
      out.push({ type: 'OB-bull', priceLow: c.low, priceHigh: c.high, formedAt: c.openTs });
    } else if (next.close < next.open && c.close > c.open) {
      out.push({ type: 'OB-bear', priceLow: c.low, priceHigh: c.high, formedAt: c.openTs });
    }
  }
  return out.slice(-4);
}

function findFairValueGaps(candles: Candle[]): SmcZone[] {
  const out: SmcZone[] = [];
  for (let i = 0; i < candles.length - 2; i++) {
    const a = candles[i];
    const c = candles[i + 2];
    if (a.high < c.low) {
      const gapPct = (c.low - a.high) / a.high;
      if (gapPct >= FVG_MIN_GAP_PCT) {
        out.push({ type: 'FVG-bull', priceLow: a.high, priceHigh: c.low, formedAt: candles[i + 1].openTs });
      }
    } else if (a.low > c.high) {
      const gapPct = (a.low - c.high) / c.high;
      if (gapPct >= FVG_MIN_GAP_PCT) {
        out.push({ type: 'FVG-bear', priceLow: c.high, priceHigh: a.low, formedAt: candles[i + 1].openTs });
      }
    }
  }
  return out.slice(-4);
}

function findEqualWicks(candles: Candle[]): SmcZone[] {
  if (candles.length < 6) return [];
  const out: SmcZone[] = [];
  const tail = candles.slice(-12);

  const highGroups = clusterByPct(tail.map((c) => c.high), EQH_TOLERANCE_PCT);
  for (const grp of highGroups) {
    if (grp.length >= 2) {
      const avg = grp.reduce((a, b) => a + b, 0) / grp.length;
      out.push({ type: 'EQH', priceLow: avg * (1 - EQH_TOLERANCE_PCT), priceHigh: avg * (1 + EQH_TOLERANCE_PCT), formedAt: tail[tail.length - 1].openTs });
    }
  }

  const lowGroups = clusterByPct(tail.map((c) => c.low), EQH_TOLERANCE_PCT);
  for (const grp of lowGroups) {
    if (grp.length >= 2) {
      const avg = grp.reduce((a, b) => a + b, 0) / grp.length;
      out.push({ type: 'EQL', priceLow: avg * (1 - EQH_TOLERANCE_PCT), priceHigh: avg * (1 + EQH_TOLERANCE_PCT), formedAt: tail[tail.length - 1].openTs });
    }
  }

  return out;
}

function clusterByPct(values: number[], tolerance: number): number[][] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let current: number[] = [];
  for (const v of sorted) {
    if (current.length === 0 || Math.abs(v - current[current.length - 1]) / current[current.length - 1] <= tolerance) {
      current.push(v);
    } else {
      if (current.length > 0) clusters.push(current);
      current = [v];
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

function lastOf<T>(arr: T[]): T | null {
  return arr.length > 0 ? arr[arr.length - 1] : null;
}
