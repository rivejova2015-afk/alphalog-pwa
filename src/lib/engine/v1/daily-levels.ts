// D1 step of Base Engine v1 — previous day's high/low and sweep detection.
//
// Per spec: D1 supplies the reference liquidity levels (PDH = previous day
// high, PDL = previous day low). A "sweep" is when price has traded beyond
// one of those levels recently — that's the manipulation that precedes the
// setup. The H1 structure must then align with the swept side (PDL↔bearish,
// PDH↔bullish) for a valid setup; that gate lives in the evaluator.

import type { Bar } from "@/types/backtest";

export type SweptSide = "PDH" | "PDL" | null;

export interface DailyLevels {
  pdh: number;          // previous day high
  pdl: number;          // previous day low
  pdhTs: string;        // ts of the D1 bar these came from
  swept: SweptSide;     // which level price has traded through recently
}

// ── SMC interpretation flags (review these) ─────────────────────────────────
// SWEEP_LOOKBACK_BARS: how many of the most recent intraday bars we scan to
//   decide a level was "manipulated". Using the intraday driver bars (M15),
//   ~32 bars ≈ 8 hours — roughly one trading session.
const SWEEP_LOOKBACK_BARS = 32;

// previousDayLevels: takes D1 bars (chronological) and returns the high/low of
// the *second-to-last* completed bar — i.e. "yesterday". The last D1 bar is
// today (still forming), so we look one back.
export function previousDayLevels(d1Bars: Bar[]): { pdh: number; pdl: number; ts: string } | null {
  if (!d1Bars || d1Bars.length < 2) return null;
  const prev = d1Bars[d1Bars.length - 2];
  if (!Number.isFinite(prev.high) || !Number.isFinite(prev.low)) return null;
  return { pdh: prev.high, pdl: prev.low, ts: prev.ts };
}

// detectSweep: scans the recent intraday bars to see if price traded beyond
// PDH (high taken) or PDL (low taken). If both were touched, the most recent
// one wins. Returns null when neither was swept.
export function detectSweep(
  intradayBars: Bar[],
  pdh: number,
  pdl: number,
  lookback = SWEEP_LOOKBACK_BARS,
): SweptSide {
  if (!intradayBars || intradayBars.length === 0) return null;
  const recent = intradayBars.slice(-lookback);

  let lastPdhIdx = -1;
  let lastPdlIdx = -1;
  for (let i = 0; i < recent.length; i++) {
    if (recent[i].high > pdh) lastPdhIdx = i;
    if (recent[i].low  < pdl) lastPdlIdx = i;
  }

  if (lastPdhIdx < 0 && lastPdlIdx < 0) return null;
  if (lastPdhIdx >= 0 && lastPdlIdx < 0) return "PDH";
  if (lastPdlIdx >= 0 && lastPdhIdx < 0) return "PDL";
  // Both swept — the more recent manipulation is the relevant one.
  return lastPdhIdx > lastPdlIdx ? "PDH" : "PDL";
}

// Convenience: full DailyLevels from D1 bars + the intraday bars used for sweep.
export function computeDailyLevels(d1Bars: Bar[], intradayBars: Bar[]): DailyLevels | null {
  const levels = previousDayLevels(d1Bars);
  if (!levels) return null;
  return {
    pdh: levels.pdh,
    pdl: levels.pdl,
    pdhTs: levels.ts,
    swept: detectSweep(intradayBars, levels.pdh, levels.pdl),
  };
}
