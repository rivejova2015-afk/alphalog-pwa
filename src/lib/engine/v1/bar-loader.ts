// Load OHLCV bars from historical_bars for a set of timeframes.
// Returns most-recent-last (chronological) so indicators can slice from the end.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bar } from "@/types/backtest";
import type { BarsByTf } from "./types";

interface HistoricalBarRow {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread: number | null;
}

export async function loadBarsForTfs(
  supabase: SupabaseClient,
  symbol: string,
  timeframes: string[],
  lookbackBars = 220,
): Promise<BarsByTf> {
  const out: BarsByTf = new Map();
  for (const tf of timeframes) {
    out.set(tf, []);
  }

  await Promise.all(
    timeframes.map(async (tf) => {
      const { data, error } = await supabase
        .from("historical_bars")
        .select("ts, open, high, low, close, volume, spread")
        .eq("symbol", symbol)
        .eq("timeframe", tf)
        .order("ts", { ascending: false })
        .limit(lookbackBars);

      if (error || !data) return;

      const bars: Bar[] = (data as HistoricalBarRow[])
        .map((r) => ({
          ts: r.ts,
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume ?? 0),
          spread: r.spread,
        }))
        .reverse();

      out.set(tf, bars);
    }),
  );

  return out;
}
