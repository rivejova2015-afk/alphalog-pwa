// H1 step of Base Engine v1 — session structure + nearby liquidity.
//
// Per spec: on H1 we read the structure of the session (bullish or bearish)
// and the liquidity sitting close to current price. Structure is derived from
// the sequence of swing points: higher highs + higher lows = bullish, lower
// highs + lower lows = bearish. "Nearby liquidity" = recent swing highs/lows
// and equal-highs/equal-lows clusters near the current price — the pools
// price is likely to reach for.

import type { Bar } from "@/types/backtest";

export type StructureBias = "bull" | "bear" | "neutral";

export interface SwingPoint {
  kind: "high" | "low";
  price: number;
  index: number;
  ts: string;
}

export interface LiquidityLevel {
  kind: "high" | "low";
  price: number;
  equalCount: number;   // how many swings cluster at this level (>=2 = "equal")
}

export interface SessionStructure {
  bias: StructureBias;
  swings: SwingPoint[];
  nearbyLiquidity: LiquidityLevel[];
}

// ── SMC interpretation flags (review these) ─────────────────────────────────
// SWING_LOOKBACK: a bar is a swing high/low if its high/low is the extreme
//   across this many bars on each side. 3 = a 7-bar fractal — standard.
const SWING_LOOKBACK = 3;
// STRUCTURE_SWINGS: how many of the most recent swings to read structure from.
//   Last 2 highs + last 2 lows is the minimal HH/HL vs LH/LL comparison.
const STRUCTURE_SWINGS = 4;
// EQUAL_TOLERANCE_PCT: two swing prices within this % of each other count as
//   an "equal high/low" liquidity cluster.
const EQUAL_TOLERANCE_PCT = 0.0010;  // 0.10%
// NEARBY_PCT: a liquidity level is "near" if within this % of current price.
const NEARBY_PCT = 0.015;            // 1.5%

export function findSwings(bars: Bar[], lookback = SWING_LOOKBACK): SwingPoint[] {
  const swings: SwingPoint[] = [];
  if (!bars || bars.length < lookback * 2 + 1) return swings;

  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) isHigh = false;
      if (bars[j].low  <= bars[i].low)  isLow = false;
    }
    if (isHigh) swings.push({ kind: "high", price: bars[i].high, index: i, ts: bars[i].ts });
    if (isLow)  swings.push({ kind: "low",  price: bars[i].low,  index: i, ts: bars[i].ts });
  }
  return swings;
}

function classifyBias(swings: SwingPoint[]): StructureBias {
  const highs = swings.filter((s) => s.kind === "high").slice(-STRUCTURE_SWINGS);
  const lows  = swings.filter((s) => s.kind === "low").slice(-STRUCTURE_SWINGS);
  if (highs.length < 2 || lows.length < 2) return "neutral";

  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price;
  const hl = lows[lows.length - 1].price  > lows[lows.length - 2].price;
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price;
  const ll = lows[lows.length - 1].price  < lows[lows.length - 2].price;

  if (hh && hl) return "bull";
  if (lh && ll) return "bear";
  return "neutral";
}

function nearbyLiquidity(swings: SwingPoint[], currentPrice: number): LiquidityLevel[] {
  const out: LiquidityLevel[] = [];
  const near = (p: number) => Math.abs(p - currentPrice) / currentPrice <= NEARBY_PCT;

  for (const kind of ["high", "low"] as const) {
    const prices = swings.filter((s) => s.kind === kind && near(s.price)).map((s) => s.price);
    const used = new Array(prices.length).fill(false);
    for (let i = 0; i < prices.length; i++) {
      if (used[i]) continue;
      const cluster = [prices[i]];
      used[i] = true;
      for (let j = i + 1; j < prices.length; j++) {
        if (used[j]) continue;
        if (Math.abs(prices[j] - prices[i]) / prices[i] <= EQUAL_TOLERANCE_PCT) {
          cluster.push(prices[j]);
          used[j] = true;
        }
      }
      const mean = cluster.reduce((s, x) => s + x, 0) / cluster.length;
      out.push({ kind, price: +mean.toFixed(5), equalCount: cluster.length });
    }
  }
  // Closest pools first.
  return out.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
}

export function sessionStructure(h1Bars: Bar[]): SessionStructure {
  const swings = findSwings(h1Bars);
  const currentPrice = h1Bars.length > 0 ? h1Bars[h1Bars.length - 1].close : 0;
  return {
    bias: classifyBias(swings),
    swings,
    nearbyLiquidity: currentPrice > 0 ? nearbyLiquidity(swings, currentPrice) : [],
  };
}
