// Multi-timeframe context: load HTF bars in parallel with the entry TF,
// align by timestamp, and provide a lookup so rules can reference HTF indicators.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bar, Timeframe } from "@/types/backtest";
import { loadHistoricalBars } from "./bars-loader";

export interface MultiTfBars {
  primary: Bar[];          // entry timeframe
  higher: Map<Timeframe, Bar[]>; // additional TFs aligned by ts
}

const TF_MINUTES: Record<Timeframe, number> = {
  M1: 1, M5: 5, M15: 15, M30: 30, H1: 60, H4: 240, D1: 1440, W1: 10_080, MN1: 43_200,
};

export async function loadMultiTf(
  supabase: SupabaseClient,
  symbol: string,
  primary: Timeframe,
  higherTfs: Timeframe[],
  from: string,
  to: string,
): Promise<MultiTfBars> {
  const [primaryBars, ...higherBarsArr] = await Promise.all([
    loadHistoricalBars(supabase, symbol, primary, from, to),
    ...higherTfs.map((tf) => loadHistoricalBars(supabase, symbol, tf, from, to)),
  ]);
  const higher = new Map<Timeframe, Bar[]>();
  higherTfs.forEach((tf, i) => higher.set(tf, higherBarsArr[i]));
  return { primary: primaryBars, higher };
}

// For a primary-bar index, find the corresponding HTF bar (the most recent HTF
// bar whose ts <= primary bar ts). O(log n) via binary search.
export function alignHtfBar(htfBars: Bar[], primaryTs: string): Bar | null {
  if (htfBars.length === 0) return null;
  const target = new Date(primaryTs).getTime();
  let lo = 0, hi = htfBars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (new Date(htfBars[mid].ts).getTime() <= target) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans >= 0 ? htfBars[ans] : null;
}

export function tfMinutes(tf: Timeframe): number {
  return TF_MINUTES[tf];
}
