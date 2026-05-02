import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bar, Timeframe } from "@/types/backtest";
import { fetchYahooBars, mapToYahooTicker } from "@/lib/backtest/yahoo-fetcher";
import { logInfo, logWarn } from "@/lib/log";

const PAGE = 1000;
const MIN_BARS = 60;

async function readBarsFromTable(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<Bar[]> {
  const out: Bar[] = [];
  let cursor = from;
  for (let page = 0; page < 200; page++) {
    const { data, error } = await supabase
      .from("historical_bars")
      .select("ts, open, high, low, close, volume, spread")
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .gte("ts", cursor)
      .lte("ts", to)
      .order("ts", { ascending: true })
      .limit(PAGE);
    if (error) throw new Error(`bars load failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      out.push({
        ts: r.ts,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume),
        spread: r.spread != null ? Number(r.spread) : null,
      });
    }
    if (data.length < PAGE) break;
    cursor = data[data.length - 1].ts;
  }
  return out;
}

async function ingestYahooBars(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[],
): Promise<void> {
  if (bars.length === 0) return;
  const rows = bars.map((b) => ({
    symbol,
    timeframe,
    ts: b.ts,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
    spread: b.spread ?? null,
    source: "histdata" as const,
    uploaded_by: null,
  }));
  // Upsert in chunks to avoid payload limits
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabase
      .from("historical_bars")
      .upsert(chunk, { onConflict: "symbol,timeframe,ts" });
    if (error) {
      logWarn("BarsLoader", "ingest chunk failed", { component: "ingestYahooBars", meta: { symbol, timeframe, message: error.message } });
      return;
    }
  }
  const tsValues = bars.map((b) => new Date(b.ts).getTime());
  await supabase.from("historical_bars_coverage").upsert(
    {
      symbol,
      timeframe,
      source: "histdata",
      range_start: new Date(Math.min(...tsValues)).toISOString(),
      range_end: new Date(Math.max(...tsValues)).toISOString(),
      bar_count: bars.length,
      last_ingest_at: new Date().toISOString(),
    },
    { onConflict: "symbol,timeframe,source" },
  );
}

export async function loadHistoricalBars(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<Bar[]> {
  const local = await readBarsFromTable(supabase, symbol, timeframe, from, to);
  if (local.length >= MIN_BARS) return local;

  // Auto-fallback: try Yahoo Finance for any symbol we have a mapping for.
  if (!mapToYahooTicker(symbol)) return local;

  try {
    logInfo("BarsLoader", `Local has ${local.length} bars — fetching from Yahoo`, {
      component: "loadHistoricalBars",
      meta: { symbol, timeframe, from, to },
    });
    const yahoo = await fetchYahooBars(symbol, timeframe, from, to);
    if (yahoo.length === 0) return local;
    await ingestYahooBars(supabase, symbol, timeframe, yahoo);
    // Re-read so we return rows including any prior local data + freshly stored.
    return await readBarsFromTable(supabase, symbol, timeframe, from, to);
  } catch (err) {
    logWarn("BarsLoader", "Yahoo fallback failed", {
      component: "loadHistoricalBars",
      meta: { symbol, timeframe, message: err instanceof Error ? err.message : String(err) },
    });
    return local;
  }
}
