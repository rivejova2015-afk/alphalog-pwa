// M1 step of Base Engine v1 — the entry trigger.
//
// Per spec: on M1 we look for the entry inside the OB (marked on M15) or an
// FVG (detected on M1). Once the D1+H1+M15 funnel has decided a direction and
// handed down the nearest OB, M1 just watches for price to trade into that
// zone — or into a fresh M1 FVG in the same direction — and fires.
//
//   BUY:  current price inside a bull OB zone, or inside a bull M1 FVG.
//   SELL: current price inside a bear OB zone, or inside a bear M1 FVG.

import type { Bar } from "@/types/backtest";
import type { OrderBlock } from "./structure";
import { findFvgs } from "./structure";

export type TradeDirection = "bull" | "bear";

export interface EntryResult {
  triggered: boolean;
  zone: "ob" | "fvg" | null;
  zoneLow: number | null;
  zoneHigh: number | null;
  reason: string;
}

// ── SMC interpretation flags (review these) ─────────────────────────────────
// ZONE_TOLERANCE_PCT: price counts as "inside" a zone if within this % padding
//   of the zone edges — avoids missing an entry by a fraction of a pip.
const ZONE_TOLERANCE_PCT = 0.0010;  // 0.10%

function priceInZone(price: number, low: number, high: number): boolean {
  const tol = price * ZONE_TOLERANCE_PCT;
  return price >= low - tol && price <= high + tol;
}

export function findEntry(
  m1Bars: Bar[],
  direction: TradeDirection,
  ob: OrderBlock | null,
): EntryResult {
  const miss: EntryResult = { triggered: false, zone: null, zoneLow: null, zoneHigh: null, reason: "no_entry" };
  if (!m1Bars || m1Bars.length === 0) {
    return { ...miss, reason: "no_m1_bars" };
  }

  const price = m1Bars[m1Bars.length - 1].close;

  // 1. Entry into the M15 order block, if one was handed down.
  if (ob && ob.side === direction && !ob.mitigatedAt) {
    if (priceInZone(price, ob.low, ob.high)) {
      return { triggered: true, zone: "ob", zoneLow: ob.low, zoneHigh: ob.high, reason: "price_in_ob" };
    }
  }

  // 2. Entry into a fresh M1 FVG in the trade direction.
  const fvgs = findFvgs(m1Bars).filter((f) => f.side === direction && !f.filledAt);
  for (const fvg of fvgs) {
    if (priceInZone(price, fvg.low, fvg.high)) {
      return { triggered: true, zone: "fvg", zoneLow: fvg.low, zoneHigh: fvg.high, reason: "price_in_m1_fvg" };
    }
  }

  return { ...miss, reason: ob ? "waiting_for_zone" : "no_ob_no_fvg" };
}
