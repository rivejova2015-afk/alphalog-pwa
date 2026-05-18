// Bars loader — single entry point for getting historical bars for a
// (symbol, timeframe) regardless of whether the data is already in our DB or
// has to be fetched from an external API.
//
// Driven by the per-symbol source-registry: the order of API fallbacks is
// declared per symbol (and per asset class default), so we never blindly hit
// Yahoo for a symbol Yahoo doesn't support.
//
// Two public functions:
//   - loadHistoricalBars(...): Bar[]                         — legacy shape
//   - loadHistoricalBarsDetailed(...): LoadResult            — returns what
//     was tried, what worked, and what to do next when nothing did
//
// The detailed shape is what bars-bootstrap surfaces to the UI.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bar, Timeframe } from "@/types/backtest";
import { fetchYahooBars, mapToYahooTicker } from "@/lib/backtest/yahoo-fetcher";
import { fetchFxratesapiBars, mapToFxratesapiPair } from "@/lib/backtest/fxratesapi-fetcher";
import { fetchOandaBars, mapToOandaInstrument } from "@/lib/backtest/oanda-fetcher";
import { getApiSourcesForTf, nextStepsForEmpty, type DataSource } from "@/lib/backtest/source-registry";
import { logInfo, logWarn } from "@/lib/log";

const PAGE = 1000;
const MIN_BARS = 60;

export interface SourceAttempt {
  source: DataSource;
  ok: boolean;
  bars: number;
  message?: string;
}

export interface LoadResult {
  bars: Bar[];
  symbol: string;
  timeframe: Timeframe;
  /** Number of bars already in DB before this load. */
  localBars: number;
  /** Source attempts walked, in order. Always includes a synthetic 'local' first when DB hit. */
  attempts: SourceAttempt[];
  /** Source that finally filled the buffer (null = nothing worked). */
  effectiveSource: DataSource | "local" | null;
  /** Actionable next steps when result is empty. */
  nextSteps: string[];
}

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

async function ingestBars(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  bars: Bar[],
  source: DataSource,
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
    source,
    uploaded_by: null,
  }));
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const { error } = await supabase
      .from("historical_bars")
      .upsert(chunk, { onConflict: "symbol,timeframe,ts" });
    if (error) {
      logWarn("BarsLoader", "ingest chunk failed", { component: "ingestBars", meta: { symbol, timeframe, source, message: error.message } });
      return;
    }
  }
  const tsValues = bars.map((b) => new Date(b.ts).getTime());
  await supabase.from("historical_bars_coverage").upsert(
    {
      symbol,
      timeframe,
      source,
      range_start: new Date(Math.min(...tsValues)).toISOString(),
      range_end: new Date(Math.max(...tsValues)).toISOString(),
      bar_count: bars.length,
      last_ingest_at: new Date().toISOString(),
    },
    { onConflict: "symbol,timeframe,source" },
  );
}

/** Try a single API source. Returns bars on success or empty + attempt info on failure. */
async function tryApiSource(
  source: DataSource,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<{ bars: Bar[]; attempt: SourceAttempt }> {
  if (source === "yahoo") {
    if (!mapToYahooTicker(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_yahoo_mapping" } };
    }
    try {
      const bars = await fetchYahooBars(symbol, timeframe, from, to);
      return { bars, attempt: { source, ok: bars.length > 0, bars: bars.length, message: bars.length === 0 ? "empty_response" : undefined } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { bars: [], attempt: { source, ok: false, bars: 0, message: msg } };
    }
  }
  if (source === "fxratesapi") {
    if (!mapToFxratesapiPair(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_fxratesapi_mapping" } };
    }
    try {
      const bars = await fetchFxratesapiBars(symbol, timeframe, from, to);
      return { bars, attempt: { source, ok: bars.length > 0, bars: bars.length, message: bars.length === 0 ? "empty_response" : undefined } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { bars: [], attempt: { source, ok: false, bars: 0, message: msg } };
    }
  }
  if (source === "oanda") {
    if (!mapToOandaInstrument(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_oanda_mapping" } };
    }
    try {
      const bars = await fetchOandaBars(symbol, timeframe, from, to);
      return { bars, attempt: { source, ok: bars.length > 0, bars: bars.length, message: bars.length === 0 ? "empty_response" : undefined } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Token-missing should soft-fail (not abort the chain) — surfaces as
      // "source disabled" in the diagnostics panel without breaking anything.
      return { bars: [], attempt: { source, ok: false, bars: 0, message: msg } };
    }
  }
  return { bars: [], attempt: { source, ok: false, bars: 0, message: `source_${source}_not_implemented_as_api` } };
}

/**
 * Detailed loader. Always returns a `LoadResult` describing what happened —
 * never throws on missing data. Use this when the caller wants to surface
 * structured diagnostics (the bootstrap route + UI panel).
 */
export async function loadHistoricalBarsDetailed(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<LoadResult> {
  const local = await readBarsFromTable(supabase, symbol, timeframe, from, to);
  const localBars = local.length;
  if (local.length >= MIN_BARS) {
    return {
      bars: local,
      symbol,
      timeframe,
      localBars,
      attempts: [{ source: "yahoo" as DataSource, ok: true, bars: local.length, message: undefined } /* sentinel — local hit */],
      effectiveSource: "local",
      nextSteps: [],
    };
  }

  // Walk API sources declared for this symbol+TF in the registry.
  const chain = getApiSourcesForTf(symbol, timeframe);
  const attempts: SourceAttempt[] = [];
  for (const src of chain) {
    const { bars, attempt } = await tryApiSource(src, symbol, timeframe, from, to);
    attempts.push(attempt);
    if (bars.length > 0) {
      try {
        await ingestBars(supabase, symbol, timeframe, bars, src);
      } catch (err) {
        logWarn("BarsLoader", "ingest failed but proceeding", {
          component: "loadHistoricalBarsDetailed",
          meta: { symbol, timeframe, src, message: err instanceof Error ? err.message : String(err) },
        });
      }
      const merged = await readBarsFromTable(supabase, symbol, timeframe, from, to);
      logInfo("BarsLoader", `fetched ${bars.length} bars from ${src} for ${symbol} ${timeframe}`, {
        component: "loadHistoricalBarsDetailed",
        meta: { localBefore: localBars, fetched: bars.length, totalAfter: merged.length },
      });
      return {
        bars: merged,
        symbol,
        timeframe,
        localBars,
        attempts,
        effectiveSource: src,
        nextSteps: [],
      };
    }
  }

  // Nothing worked — return what we have (possibly partial local) + actionable suggestions.
  return {
    bars: local,
    symbol,
    timeframe,
    localBars,
    attempts,
    effectiveSource: localBars > 0 ? "local" : null,
    nextSteps: nextStepsForEmpty(symbol, timeframe),
  };
}

/**
 * Backward-compatible wrapper that returns just the bars (no diagnostics).
 * Callers that don't need to render the source chain stay simple.
 */
export async function loadHistoricalBars(
  supabase: SupabaseClient,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<Bar[]> {
  const r = await loadHistoricalBarsDetailed(supabase, symbol, timeframe, from, to);
  return r.bars;
}
