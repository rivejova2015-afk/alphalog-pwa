// Price-structure features used by the Base Engine v1 to refine the
// pure-trend bias coming from EMAs. Two classic SMC primitives:
//
//   - Order Block (OB): the last bearish candle before a strong bullish
//     impulse (bull OB) or vice-versa (bear OB). The candle body becomes a
//     zone the market often retraces to. We mark an OB as "active" until
//     its body has been fully traded through (mitigated).
//
//   - Fair Value Gap (FVG): a 3-candle pattern where bar[i] does not
//     overlap bar[i-2] — a gap left in the price action. Bullish FVG when
//     low[i] > high[i-2]; bearish when high[i] < low[i-2]. Active until
//     a later bar fills the gap.
//
// structureBias() returns a number in [-30, +30] that is added to the trend
// bias for that TF when the current price sits inside (or very near) an
// active zone in a directional way. Bounded so structure complements rather
// than overrides the trend cascade.

import type { Bar } from "@/types/backtest";

export type ZoneSide = "bull" | "bear";

export interface OrderBlock {
  side: ZoneSide;
  low: number;
  high: number;
  formedAt: string;
  mitigatedAt?: string;
}

export interface Fvg {
  side: ZoneSide;
  low: number;
  high: number;
  formedAt: string;
  filledAt?: string;
}

const DEFAULT_LOOKBACK = 50;
const IMPULSE_BODY_MULTIPLIER = 1.5;     // impulse body must exceed N * avg body
const NEAR_ZONE_TOLERANCE_PCT = 0.0015;  // 0.15% of price = "near" the zone

function avgBody(bars: Bar[]): number {
  if (bars.length === 0) return 0;
  let s = 0;
  for (const b of bars) s += Math.abs(b.close - b.open);
  return s / bars.length;
}

export function findOrderBlocks(bars: Bar[], lookback = DEFAULT_LOOKBACK): OrderBlock[] {
  const out: OrderBlock[] = [];
  if (bars.length < 4) return out;

  const start = Math.max(1, bars.length - lookback);
  const ref = bars.slice(Math.max(0, start - 20), bars.length);
  const avg = avgBody(ref);
  if (avg <= 0) return out;

  // Scan for impulse candles; the preceding opposite candle becomes the OB.
  for (let i = start; i < bars.length; i++) {
    const b = bars[i];
    const body = Math.abs(b.close - b.open);
    if (body < avg * IMPULSE_BODY_MULTIPLIER) continue;

    const isBullImpulse = b.close > b.open;
    const isBearImpulse = b.close < b.open;

    // Walk back to find the last opposite-direction candle.
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const prev = bars[j];
      if (isBullImpulse && prev.close < prev.open) {
        out.push({
          side: "bull",
          low: prev.low,
          high: Math.max(prev.open, prev.close),
          formedAt: prev.ts,
        });
        break;
      }
      if (isBearImpulse && prev.close > prev.open) {
        out.push({
          side: "bear",
          low: Math.min(prev.open, prev.close),
          high: prev.high,
          formedAt: prev.ts,
        });
        break;
      }
    }
  }

  // Mark mitigated OBs (price has fully traversed the body since formation).
  for (const ob of out) {
    const formedIdx = bars.findIndex((b) => b.ts === ob.formedAt);
    if (formedIdx < 0) continue;
    for (let k = formedIdx + 1; k < bars.length; k++) {
      const bar = bars[k];
      if (ob.side === "bull" && bar.low <= ob.low) { ob.mitigatedAt = bar.ts; break; }
      if (ob.side === "bear" && bar.high >= ob.high) { ob.mitigatedAt = bar.ts; break; }
    }
  }

  return out;
}

export function findFvgs(bars: Bar[], lookback = DEFAULT_LOOKBACK): Fvg[] {
  const out: Fvg[] = [];
  if (bars.length < 3) return out;

  const start = Math.max(2, bars.length - lookback);
  for (let i = start; i < bars.length; i++) {
    const a = bars[i - 2];
    const c = bars[i];
    // Bullish FVG: gap between a.high and c.low (a.high < c.low).
    if (c.low > a.high) {
      out.push({ side: "bull", low: a.high, high: c.low, formedAt: c.ts });
    } else if (c.high < a.low) {
      out.push({ side: "bear", low: c.high, high: a.low, formedAt: c.ts });
    }
  }

  // Mark filled FVGs.
  for (const fvg of out) {
    const formedIdx = bars.findIndex((b) => b.ts === fvg.formedAt);
    if (formedIdx < 0) continue;
    for (let k = formedIdx + 1; k < bars.length; k++) {
      const bar = bars[k];
      if (fvg.side === "bull" && bar.low <= fvg.low) { fvg.filledAt = bar.ts; break; }
      if (fvg.side === "bear" && bar.high >= fvg.high) { fvg.filledAt = bar.ts; break; }
    }
  }

  return out;
}

function nearZone(price: number, zoneLow: number, zoneHigh: number): boolean {
  const tol = price * NEAR_ZONE_TOLERANCE_PCT;
  return price >= zoneLow - tol && price <= zoneHigh + tol;
}

export interface StructureBiasResult {
  bias: number;             // -30..+30
  activeBullOb: number;
  activeBearOb: number;
  activeBullFvg: number;
  activeBearFvg: number;
}

export function structureBias(bars: Bar[]): StructureBiasResult {
  const empty: StructureBiasResult = {
    bias: 0, activeBullOb: 0, activeBearOb: 0, activeBullFvg: 0, activeBearFvg: 0,
  };
  if (bars.length < 10) return empty;

  const obs = findOrderBlocks(bars).filter((o) => !o.mitigatedAt);
  const fvgs = findFvgs(bars).filter((f) => !f.filledAt);

  const last = bars[bars.length - 1];
  const price = last.close;

  let bias = 0;
  const summary = { ...empty };

  for (const ob of obs) {
    if (ob.side === "bull") summary.activeBullOb++;
    else summary.activeBearOb++;
    if (nearZone(price, ob.low, ob.high)) {
      bias += ob.side === "bull" ? 15 : -15;
    }
  }
  for (const fvg of fvgs) {
    if (fvg.side === "bull") summary.activeBullFvg++;
    else summary.activeBearFvg++;
    if (nearZone(price, fvg.low, fvg.high)) {
      bias += fvg.side === "bull" ? 10 : -10;
    }
  }

  summary.bias = Math.max(-30, Math.min(30, bias));
  return summary;
}
