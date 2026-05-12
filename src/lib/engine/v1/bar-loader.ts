// Load OHLCV bars from historical_bars for a set of timeframes.
// Returns most-recent-last (chronological) so indicators can slice from the end.
//
// Module-level cache: each (symbol, timeframe) pair is cached with a per-TF
// TTL so repeated polls in the same Fluid Compute instance skip the DB hit.
// TTLs are tuned to be shorter than the bar period — fresh bar uploads always
// invalidate quickly, but we don't re-query 6 TFs every 5 seconds.

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

interface CacheEntry {
  bars: Bar[];
  fetchedAt: number;
}

const TF_TTL_MS: Record<string, number> = {
  M1:  15_000,   // 15s
  M5:  30_000,   // 30s
  M15: 60_000,   // 1m
  M30: 120_000,
  H1:  300_000,  // 5m
  H4:  900_000,  // 15m
  D1:  3_600_000,// 1h
  W1:  21_600_000, // 6h
  MN1: 86_400_000, // 24h
};

const cache = new Map<string, CacheEntry>();

function ttlFor(tf: string): number {
  return TF_TTL_MS[tf] ?? 60_000;
}

function cacheKey(symbol: string, tf: string): string {
  return `${symbol}:${tf}`;
}

export function clearBarCache(): void {
  cache.clear();
}

export async function loadBarsForTfs(
  supabase: SupabaseClient,
  symbol: string,
  timeframes: string[],
  lookbackBars = 220,
): Promise<BarsByTf> {
  const out: BarsByTf = new Map();
  const now = Date.now();
  const toFetch: string[] = [];

  for (const tf of timeframes) {
    const cached = cache.get(cacheKey(symbol, tf));
    if (cached && now - cached.fetchedAt < ttlFor(tf)) {
      out.set(tf, cached.bars);
    } else {
      out.set(tf, []);
      toFetch.push(tf);
    }
  }

  if (toFetch.length === 0) return out;

  await Promise.all(
    toFetch.map(async (tf) => {
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
      cache.set(cacheKey(symbol, tf), { bars, fetchedAt: Date.now() });
    }),
  );

  return out;
}
