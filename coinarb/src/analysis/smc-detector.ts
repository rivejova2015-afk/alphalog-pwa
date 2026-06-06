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
import { PD_MACRO_BAND, PD_MICRO_BAND, PD_MACRO_DAYS, SWEEP_CONFIRM_BODY_RATIO } from '../core/config.js';

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

// ============================================================
// SMC POTENCIADO — 4 elementos
// ============================================================

export type ConfluenceGrade = 'A' | 'B' | 'FALLBACK' | 'NONE';

export interface ConfluenceResult {
  grade: ConfluenceGrade;
  kellyMultiplier: number;
  ob: SmcZone | null;
  fvg: SmcZone | null;
  eql: SmcZone | null;
  entryPrice: number;
}

// Grade A = OB+FVG+EQH/EQL → Kelly 1.5x
// Grade B = OB+FVG → Kelly 1.0x
// FALLBACK = OB solo (si pace < 8 ops/2h) → Kelly 0.8x
export function evaluateConfluence(
  signal: SmcSignal,
  bias: SmcBias,
  currentPace: number,
): ConfluenceResult {
  const dirSuffix = bias === 'BUY' ? 'bull' : 'bear';
  const eqlType   = bias === 'BUY' ? 'EQL'  : 'EQH';

  const ob  = signal.zones.find(z => z.type === `OB-${dirSuffix}`) ?? null;
  const fvg = signal.zones.find(z => z.type === `FVG-${dirSuffix}`) ?? null;
  const eql = signal.zones.find(z => z.type === eqlType) ?? null;
  const entryPrice = ob ? (bias === 'BUY' ? ob.priceHigh : ob.priceLow) : 0;

  if (ob && fvg && eql) return { grade: 'A', kellyMultiplier: 1.5, ob, fvg, eql, entryPrice };
  if (ob && fvg)        return { grade: 'B', kellyMultiplier: 1.0, ob, fvg, eql: null, entryPrice };
  if (ob && currentPace < 8) return { grade: 'FALLBACK', kellyMultiplier: 0.8, ob, fvg: null, eql: null, entryPrice };

  return { grade: 'NONE', kellyMultiplier: 0, ob: null, fvg: null, eql: null, entryPrice: 0 };
}

export interface SweepResult {
  detected: boolean;
  type: 'BUYSIDE' | 'SELLSIDE' | null;
  sweptPrice: number | null;
}

// 5min detecta sweep + 1min confirma reversion
export function detectLiquiditySweep(
  candles5m: Candle[],
  candles1m: Candle[],
  signal5m: SmcSignal,
): SweepResult {
  if (candles5m.length < 5 || candles1m.length < 3) {
    return { detected: false, type: null, sweptPrice: null };
  }
  const last5m = candles5m[candles5m.length - 1];
  const last1m  = candles1m[candles1m.length - 1];
  const eqh = signal5m.zones.find(z => z.type === 'EQH');
  const eql = signal5m.zones.find(z => z.type === 'EQL');

  if (eqh && last5m.high > eqh.priceHigh && last5m.close < eqh.priceLow) {
    const body = Math.abs(last1m.close - last1m.open);
    const range = last1m.high - last1m.low;
    if (range > 0 && body / range >= SWEEP_CONFIRM_BODY_RATIO && last1m.close < last1m.open) {
      return { detected: true, type: 'BUYSIDE', sweptPrice: eqh.priceHigh };
    }
  }
  if (eql && last5m.low < eql.priceLow && last5m.close > eql.priceHigh) {
    const body = Math.abs(last1m.close - last1m.open);
    const range = last1m.high - last1m.low;
    if (range > 0 && body / range >= SWEEP_CONFIRM_BODY_RATIO && last1m.close > last1m.open) {
      return { detected: true, type: 'SELLSIDE', sweptPrice: eql.priceLow };
    }
  }
  return { detected: false, type: null, sweptPrice: null };
}

export interface ChochDisplacementResult {
  confirmed: boolean;
  ob1mAligned: SmcZone | null;
  reason: string;
}

// CHOCH en 15m/5m alineado con HTF + impulso 1m que toca OB de 1m
export function validateChochDisplacement(
  signal15m: SmcSignal,
  signal5m: SmcSignal,
  signal1m: SmcSignal,
  htfBias: SmcBias,
  candles1m: Candle[],
): ChochDisplacementResult {
  if (htfBias === 'NEUTRAL') {
    return { confirmed: false, ob1mAligned: null, reason: 'htf_neutral' };
  }
  const chochAligned =
    (signal15m.choch && signal15m.bias === htfBias) ||
    (signal5m.choch  && signal5m.bias  === htfBias);

  if (!chochAligned) {
    return { confirmed: false, ob1mAligned: null, reason: 'no_choch_aligned' };
  }
  const dirSuffix = htfBias === 'BUY' ? 'bull' : 'bear';
  const ob1m = signal1m.zones.find(z => z.type === `OB-${dirSuffix}`) ?? null;
  if (!ob1m) {
    return { confirmed: false, ob1mAligned: null, reason: 'no_ob_1m' };
  }
  const impulse = candles1m.slice(-5).find(c => {
    const body  = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    if (range === 0) return false;
    const isDir = htfBias === 'BUY' ? c.close > c.open : c.close < c.open;
    return (body / range) >= 0.60 && isDir;
  });
  if (!impulse) return { confirmed: false, ob1mAligned: ob1m, reason: 'no_impulse_candle' };

  const touchesOB = impulse.low <= ob1m.priceHigh && impulse.high >= ob1m.priceLow;
  if (!touchesOB) return { confirmed: false, ob1mAligned: ob1m, reason: 'impulse_misses_ob' };

  return { confirmed: true, ob1mAligned: ob1m, reason: 'confirmed' };
}

export type PriceZone = 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';

export interface PremiumDiscountResult {
  allowed: boolean;
  macroZone: PriceZone;
  microZone: PriceZone;
  reason: string;
}

// BUY when macro+micro lean DISCOUNT (or one of them sits in EQUILIBRIUM with the other aligned).
// SELL is the mirror. Bands and macro range are env-tunable so we can soften without redeploy.
//
// Structural override: when smcSignal carries an active BOS or CHOCH and bias != NEUTRAL,
// EQUILIBRIUM+EQUILIBRIUM is allowed — the structure has already validated direction so the
// "price is in the middle of the range" block stops contradicting the SMC verdict.
export function evaluatePremiumDiscount(
  currentPrice: number,
  candles1D: Candle[],
  candles5m: Candle[],
  bias: SmcBias,
  smcSignal?: SmcSignal,
): PremiumDiscountResult {
  if (smcSignal && (smcSignal.bos || smcSignal.choch) && bias !== 'NEUTRAL') {
    return {
      allowed: true,
      macroZone: 'EQUILIBRIUM',
      microZone: 'EQUILIBRIUM',
      reason: `bos_choch_override bos=${smcSignal.bos} choch=${smcSignal.choch}`,
    };
  }
  if (bias === 'NEUTRAL') {
    return { allowed: false, macroZone: 'EQUILIBRIUM', microZone: 'EQUILIBRIUM', reason: 'bias_neutral' };
  }
  const last3Days = candles1D.slice(-PD_MACRO_DAYS);
  if (last3Days.length === 0) {
    return { allowed: true, macroZone: 'DISCOUNT', microZone: 'DISCOUNT', reason: 'no_macro_data' };
  }
  const macroHigh = Math.max(...last3Days.map(c => c.high));
  const macroLow  = Math.min(...last3Days.map(c => c.low));
  const macroMid  = (macroHigh + macroLow) / 2;
  const macroZone: PriceZone =
    currentPrice < macroMid * (1 - PD_MACRO_BAND) ? 'DISCOUNT' :
    currentPrice > macroMid * (1 + PD_MACRO_BAND) ? 'PREMIUM' : 'EQUILIBRIUM';

  const recent5m = candles5m.slice(-20);
  if (recent5m.length < 5) {
    return { allowed: true, macroZone, microZone: 'DISCOUNT', reason: 'no_micro_data' };
  }
  const microHigh = Math.max(...recent5m.map(c => c.high));
  const microLow  = Math.min(...recent5m.map(c => c.low));
  const microMid  = (microHigh + microLow) / 2;
  const microZone: PriceZone =
    currentPrice < microMid * (1 - PD_MICRO_BAND) ? 'DISCOUNT' :
    currentPrice > microMid * (1 + PD_MICRO_BAND) ? 'PREMIUM' : 'EQUILIBRIUM';

  // PD allowed combinations. Three layers:
  //   1. Strict zone-aligned setups (original 6 combos) — best quality.
  //   2. EQ+EQ when bias is directional — neutral zones where MTF +
  //      downstream sweep/CHOCH/confluence still gate quality.
  //   3. Counter-macro pullback combos — mean-reversion plays where macro
  //      shows one zone and micro just pulled back to the opposite. Valid
  //      SMC pattern for ranging markets where the bot would otherwise sit
  //      out entirely. Sweep + CHOCH must still confirm direction downstream.
  const allowed =
    (bias === 'BUY'  && macroZone === 'DISCOUNT'    && microZone === 'DISCOUNT')    ||
    (bias === 'SELL' && macroZone === 'PREMIUM'     && microZone === 'PREMIUM')     ||
    (bias === 'BUY'  && macroZone === 'EQUILIBRIUM' && microZone === 'DISCOUNT')    ||
    (bias === 'SELL' && macroZone === 'EQUILIBRIUM' && microZone === 'PREMIUM')     ||
    (bias === 'BUY'  && macroZone === 'DISCOUNT'    && microZone === 'EQUILIBRIUM') ||
    (bias === 'SELL' && macroZone === 'PREMIUM'     && microZone === 'EQUILIBRIUM') ||
    (macroZone === 'EQUILIBRIUM' && microZone === 'EQUILIBRIUM') ||
    (bias === 'BUY'  && macroZone === 'PREMIUM'     && microZone === 'DISCOUNT')    ||
    (bias === 'SELL' && macroZone === 'DISCOUNT'    && microZone === 'PREMIUM');

  return {
    allowed,
    macroZone,
    microZone,
    reason: allowed ? 'zone_aligned' : `macro=${macroZone}_micro=${microZone}`,
  };
}
