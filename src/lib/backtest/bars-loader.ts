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
import { fetchPolygonBars, mapToPolygonTicker } from "@/lib/backtest/polygon-fetcher";
import { fetchTwelveDataBars, mapToTwelveDataSymbol } from "@/lib/backtest/twelvedata-fetcher";
import { fetchPolygonFuturesBars, mapToPolygonFuturesTicker } from "@/lib/backtest/polygon-futures-fetcher";
import { getApiSourcesForTf, nextStepsForEmpty, type DataSource } from "@/lib/backtest/source-registry";
import { withRetry } from "@/lib/backtest/retry";
import { logInfo, logWarn } from "@/lib/log";

/**
 * Tunable retry budget for individual source fetches. 2 retries = up to 3
 * attempts per source before we walk to the next entry in the chain. With
 * baseDelay=500ms exponential, total worst-case wait is ~500 + 1000 = 1.5s
 * per source before fall-through — still much cheaper than dropping to a
 * less-preferred source.
 *
 * In tests we collapse the delay to 1ms so the existing bars-loader suite
 * doesn't spend seconds waiting between mocked retries. Production still uses
 * the full backoff. NODE_ENV='test' is set by vitest automatically.
 */
const SOURCE_RETRY_OPTS = {
  maxRetries: 2,
  baseDelayMs: process.env.NODE_ENV === "test" ? 1 : 500,
} as const;

/**
 * Helper that wraps a source fetcher with the standard retry budget and
 * normalizes the result to the SourceAttempt shape. Centralizes the
 * boilerplate that used to live in every branch of `tryApiSource`.
 */
async function fetchWithRetry(
  source: DataSource,
  fetcher: () => Promise<Bar[]>,
): Promise<{ bars: Bar[]; attempt: SourceAttempt }> {
  try {
    const { value: bars, attempts } = await withRetry(fetcher, SOURCE_RETRY_OPTS);
    const baseMsg = bars.length === 0 ? "empty_response" : undefined;
    const msg = attempts > 1
      ? `${baseMsg ? baseMsg + " — " : ""}succeeded after ${attempts - 1} retry${attempts - 1 === 1 ? "" : "ies"}`
      : baseMsg;
    return { bars, attempt: { source, ok: bars.length > 0, bars: bars.length, message: msg, attempts } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { bars: [], attempt: { source, ok: false, bars: 0, message: msg, attempts: SOURCE_RETRY_OPTS.maxRetries + 1 } };
  }
}

const PAGE = 1000;
const MIN_BARS = 60;

// Per-TF staleness threshold: when the most-recent local bar is older than
// the listed number of milliseconds, the loader treats the local cache as
// "fresh enough but missing the most recent close" and walks the API chain
// to top up. Rule of thumb: ~2x the bar period — if the latest closed bar
// is more than 2 periods old we've missed at least one close, which matters
// for the live dispatcher cron that evaluates the engine on every M1 close.
//
// For backtest paths (where `to` is historical, not "now") staleness doesn't
// apply — see `isStale` for the "to within X seconds of now" guard.
const STALE_THRESHOLD_MS: Record<Timeframe, number> = {
  M1:  2  * 60_000,
  M5:  10 * 60_000,
  M15: 30 * 60_000,
  M30: 60 * 60_000,
  H1:  2  * 60 * 60_000,
  H4:  8  * 60 * 60_000,
  D1:  2  * 24 * 60 * 60_000,
  W1:  10 * 24 * 60 * 60_000,
  MN1: 40 * 24 * 60 * 60_000,
};

/**
 * True when the requested window includes "now" (within 60s) AND the latest
 * local bar is older than the per-TF staleness threshold. In that case
 * loadHistoricalBars walks the API chain even though local.length >= MIN_BARS
 * — the cache is large enough but the *tail* is stale, and the dispatcher
 * cron needs the freshest bar to make a decision.
 *
 * If `to` is historical (e.g. a backtest), we never consider local stale —
 * past windows can never get fresher.
 */
function isStale(local: Bar[], timeframe: Timeframe, toIso: string): boolean {
  if (local.length === 0) return false;
  const toMs = new Date(toIso).getTime();
  if (!Number.isFinite(toMs)) return false;
  const nowMs = Date.now();
  // Only stale-check when the request reaches into "now". Backtest paths
  // (to = some date in the past) never trigger refetch.
  if (nowMs - toMs > 60_000) return false;

  const latest = local[local.length - 1];
  const latestMs = new Date(latest.ts).getTime();
  if (!Number.isFinite(latestMs)) return false;

  const threshold = STALE_THRESHOLD_MS[timeframe] ?? STALE_THRESHOLD_MS.H1;
  return nowMs - latestMs > threshold;
}

export interface SourceAttempt {
  source: DataSource;
  ok: boolean;
  bars: number;
  message?: string;
  /**
   * Total attempts made for this source (1 = no retries). Surfaces "succeeded
   * after 2 retries" in the diagnostics panel so the user knows the network
   * had blips but the chain recovered without falling to a less-preferred
   * source.
   */
  attempts?: number;
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

/**
 * Try a single API source. Returns bars on success or empty + attempt info on
 * failure. Each source fetch is wrapped with `fetchWithRetry` so transient
 * errors (429 / 5xx / network blips) get up to 2 retries with exponential
 * backoff before we walk to the next entry in the chain. Non-retryable
 * errors (401 / 403 / missing key / unmapped symbol) fail fast.
 */
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
    return fetchWithRetry(source, () => fetchYahooBars(symbol, timeframe, from, to));
  }
  if (source === "fxratesapi") {
    if (!mapToFxratesapiPair(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_fxratesapi_mapping" } };
    }
    return fetchWithRetry(source, () => fetchFxratesapiBars(symbol, timeframe, from, to));
  }
  if (source === "oanda") {
    if (!mapToOandaInstrument(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_oanda_mapping" } };
    }
    return fetchWithRetry(source, () => fetchOandaBars(symbol, timeframe, from, to));
  }
  if (source === "polygon") {
    if (!mapToPolygonTicker(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_polygon_mapping" } };
    }
    return fetchWithRetry(source, () => fetchPolygonBars(symbol, timeframe, from, to));
  }
  if (source === "twelvedata") {
    if (!mapToTwelveDataSymbol(symbol)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_twelvedata_mapping" } };
    }
    return fetchWithRetry(source, () => fetchTwelveDataBars(symbol, timeframe, from, to));
  }
  if (source === "polygon-futures") {
    if (!mapToPolygonFuturesTicker(symbol, to)) {
      return { bars: [], attempt: { source, ok: false, bars: 0, message: "no_polygon_futures_mapping" } };
    }
    return fetchWithRetry(source, () => fetchPolygonFuturesBars(symbol, timeframe, from, to));
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
  const stale = isStale(local, timeframe, to);

  // Local cache is sufficient AND fresh → short-circuit, no API call.
  // For backtest paths (to in the past) `stale` is always false so this
  // path is the common case.
  if (local.length >= MIN_BARS && !stale) {
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

  if (stale) {
    logInfo("BarsLoader", `local cache stale for ${symbol} ${timeframe} (latest=${local[local.length - 1]?.ts}) — refetching from API chain`, {
      component: "loadHistoricalBarsDetailed",
      meta: { symbol, timeframe, localBars, latestTs: local[local.length - 1]?.ts },
    });
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
