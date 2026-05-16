// M15 step of Base Engine v1 — Break of Structure detection + nearest OB.
//
// Per spec: on M15 we verify a BOS (Break of Structure). The BOS direction
// IS the trade direction — whether it's "a favor" (same as H1 structure) or
// "en contra" (against H1, signalling a structure change). The evaluator
// classifies a-favor vs en-contra; this module just reports the raw BOS and
// the order block closest to current price in that direction.
//
//   Bull BOS: price closes above the most recent confirmed swing high.
//   Bear BOS: price closes below the most recent confirmed swing low.

import type { Bar } from "@/types/backtest";
import { findSwings } from "./session-structure";
import { findOrderBlocks, type OrderBlock } from "./structure";

export type BosDirection = "bull" | "bear" | null;

export interface BosResult {
  direction: BosDirection;
  brokenSwingPrice: number | null;   // the swing level that was broken
  brokenSwingTs: string | null;
  nearestOB: OrderBlock | null;      // closest unmitigated OB in BOS direction
}

// ── SMC interpretation flags (review these) ─────────────────────────────────
// SWING_LOOKBACK: fractal size for swing detection on M15 (same convention as
//   session-structure). 3 = 7-bar fractal.
const SWING_LOOKBACK = 3;
// BOS_CONFIRM: BOS requires a *close* beyond the swing, not just a wick — a
//   wick through is a sweep, a close through is a break. We use bar.close.

// detectBOS: finds the most recent break of structure on the M15 series.
// Scans from the latest bar backwards for the first close that broke the
// nearest prior swing high (bull) or swing low (bear).
export function detectBOS(m15Bars: Bar[]): BosResult {
  const empty: BosResult = { direction: null, brokenSwingPrice: null, brokenSwingTs: null, nearestOB: null };
  if (!m15Bars || m15Bars.length < SWING_LOOKBACK * 2 + 3) return empty;

  const swings = findSwings(m15Bars, SWING_LOOKBACK);
  if (swings.length === 0) return empty;

  const highs = swings.filter((s) => s.kind === "high");
  const lows  = swings.filter((s) => s.kind === "low");
  const last = m15Bars[m15Bars.length - 1];

  // Most recent swing high strictly before the last bar.
  const lastHigh = [...highs].reverse().find((s) => s.index < m15Bars.length - 1);
  const lastLow  = [...lows].reverse().find((s) => s.index < m15Bars.length - 1);

  let direction: BosDirection = null;
  let brokenSwingPrice: number | null = null;
  let brokenSwingTs: string | null = null;

  if (lastHigh && last.close > lastHigh.price) {
    direction = "bull";
    brokenSwingPrice = lastHigh.price;
    brokenSwingTs = lastHigh.ts;
  } else if (lastLow && last.close < lastLow.price) {
    direction = "bear";
    brokenSwingPrice = lastLow.price;
    brokenSwingTs = lastLow.ts;
  }

  if (!direction) return empty;

  // Nearest unmitigated OB in the BOS direction (bull BOS → bull OB).
  const wantSide = direction === "bull" ? "bull" : "bear";
  const obs = findOrderBlocks(m15Bars).filter((o) => o.side === wantSide && !o.mitigatedAt);
  const price = last.close;
  const nearestOB = obs.length > 0
    ? obs.reduce((best, ob) => {
        const dBest = Math.abs((best.low + best.high) / 2 - price);
        const dOb   = Math.abs((ob.low + ob.high) / 2 - price);
        return dOb < dBest ? ob : best;
      })
    : null;

  return { direction, brokenSwingPrice, brokenSwingTs, nearestOB };
}
