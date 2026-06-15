// Polygon.io / Massive Futures aggregates fetcher — V1 Futures REST API
// (promoted to stable in May 2026).
//
// IMPORTANT: Polygon's futures endpoint differs from spot in two ways:
//   1. URL path: /futures/v1/aggs/{ticker}?... (NOT /v2/aggs/ticker/...)
//   2. Tickers are per-contract-month — no built-in "continuous front-month"
//      series. We synthesize one by computing the active front-month contract
//      code for the END of the requested date range (e.g. ES + Sep 2026 →
//      "ESU26") and fetching that single contract's bars.
//
// Limitations of the front-month approach (documented for the operator):
//   - If `to - from` exceeds the contract's listed window (~3–9 months
//     depending on product), we only return bars for the most recent contract.
//     The bars-loader will ingest them, but for backtests spanning multiple
//     years, Yahoo's "=F" continuation series (already in the chain) remains
//     the more practical source.
//   - We don't attempt to splice consecutive contracts together. If a backtest
//     needs that fidelity, importing CSV from Tradovate/CME is canonical.
//
// When POLYGON_API_KEY is missing the fetcher throws cleanly — bars-loader
// treats as "source not configured" and walks to the next entry in the chain.
//
// Endpoint: GET /futures/v1/aggs/{ticker}?resolution={n}{unit}&window_start.gte={d}&window_start.lte={d}
// Docs:     https://massive.com/docs/rest/futures/aggregates

import type { Bar, Timeframe } from "@/types/backtest";

export interface PolygonFuturesTicker {
  /** The full contract code (e.g. "ESU26" for E-mini S&P September 2026). */
  ticker: string;
  /** The base symbol (e.g. "ES") for diagnostics. */
  baseSymbol: string;
}

// CME single-letter month codes. Index by 0-based month number (Jan = 0).
const MONTH_CODES = [
  "F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z",
] as const;

// Per-symbol contract cycle — which months trade. Values are 0-based month
// numbers (Jan = 0, Dec = 11). Simplified vs. CME's real expiration calendar
// because for backtest seed we don't need day-precision rolls.
const CONTRACT_CYCLE: Record<string, number[]> = {
  // ── Quarterly (Mar/Jun/Sep/Dec) — equity index + treasury futures
  ES:  [2, 5, 8, 11],
  NQ:  [2, 5, 8, 11],
  YM:  [2, 5, 8, 11],
  RTY: [2, 5, 8, 11],
  ZB:  [2, 5, 8, 11],
  ZN:  [2, 5, 8, 11],
  ZF:  [2, 5, 8, 11],
  ZT:  [2, 5, 8, 11],

  // ── Monthly (all 12 months) — energy + copper
  CL:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  NG:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  BZ:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  HO:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  RB:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  HG:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],

  // ── Metals (CME's main contracts — bi-monthly cycles)
  GC:  [1, 3, 5, 7, 9, 11],     // G / J / M / Q / V / Z
  SI:  [2, 4, 6, 8, 11],        // H / K / N / U / Z
  PL:  [0, 3, 6, 9],            // F / J / N / V

  // ── Grains (CBOT) — varies per symbol, simplified to most-active months
  ZC:  [2, 4, 6, 8, 11],        // H / K / N / U / Z (corn)
  ZS:  [0, 2, 4, 6, 7, 8, 10],  // F / H / K / N / Q / U / X (soybeans)
  ZW:  [2, 4, 6, 8, 11],        // H / K / N / U / Z (wheat)
  ZL:  [0, 2, 4, 6, 7, 8, 9, 11], // soybean oil — approximated
  ZM:  [0, 2, 4, 6, 7, 8, 9, 11], // soybean meal — approximated
};

const RESOLUTION_MAP: Record<Timeframe, string> = {
  M1:  "1min",
  M5:  "5min",
  M15: "15min",
  M30: "30min",
  H1:  "1hour",
  H4:  "4hour",
  D1:  "1session",  // futures use "session" (one trading session = one day)
  W1:  "1week",
  MN1: "1month",
};

const MAX_RESULTS = 50_000;
const FETCH_TIMEOUT_MS = 15_000;

interface PolygonFuturesAggregateResponse {
  status?: string;
  error?: string;
  message?: string;
  results?: Array<{
    window_start?: number;  // Unix ms timestamp (start of bar) — futures API uses this name
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
    // Some responses use the v2-spot field names; we accept both for robustness.
    t?: number;
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
  }>;
}

/**
 * Compute the front-month contract code for a given base symbol at a target
 * date. Returns `null` if the symbol isn't in the futures cycle table.
 *
 * Algorithm: find the next contract month in the cycle that is >= the target
 * month. If none in the current year, take the first month of the next year.
 *
 * Simplification: we don't subtract a roll buffer (CME rolls ~8 trading days
 * before expiration). For seed bars the off-by-one-month edge cases at
 * roll boundaries are acceptable — backtests on recent data get the most
 * liquid contract, older windows fall through to Yahoo via the chain.
 *
 * Exported for testing — callers should use mapToPolygonFuturesTicker().
 */
export function frontMonthContract(symbol: string, targetDate: Date): string | null {
  const up = symbol.toUpperCase();
  const cycle = CONTRACT_CYCLE[up];
  if (!cycle) return null;
  if (!Number.isFinite(targetDate.getTime())) return null;

  let year = targetDate.getUTCFullYear();
  const month = targetDate.getUTCMonth();

  // Find the next cycle month >= current month
  let nextMonth = cycle.find((m) => m >= month);
  if (nextMonth === undefined) {
    nextMonth = cycle[0];
    year += 1;
  }

  const monthCode = MONTH_CODES[nextMonth];
  const yearCode = String(year).slice(-2);
  return `${up}${monthCode}${yearCode}`;
}

/**
 * Map our internal futures symbol → full Polygon contract ticker, picking
 * the front-month contract for the END of the requested date range.
 */
export function mapToPolygonFuturesTicker(symbol: string, toDateIso: string): PolygonFuturesTicker | null {
  const up = symbol.toUpperCase();
  const date = new Date(toDateIso);
  const ticker = frontMonthContract(up, date);
  if (!ticker) return null;
  return { ticker, baseSymbol: up };
}

function getApiKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || null;
}

/**
 * Fetch OHLCV bars for a futures contract from Polygon's V1 Futures API.
 *
 * Strategy: we resolve the symbol to its front-month contract for the END
 * of the requested range and fetch that single contract's bars. The result
 * is filtered to the [fromIso, toIso] window before being returned.
 *
 * Throws on:
 *   - Missing POLYGON_API_KEY
 *   - Unmapped symbol (no contract cycle in our table)
 *   - HTTP failures (429 rate limit, 403 subscription tier, 401 auth)
 *
 * Returns [] when the request succeeds but the contract has no bars in the
 * window (typical for pre-listing dates of newer contracts).
 */
export async function fetchPolygonFuturesBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");

  const mapping = mapToPolygonFuturesTicker(symbol, toIso);
  if (!mapping) throw new Error(`No Polygon Futures mapping for symbol ${symbol}`);

  const resolution = RESOLUTION_MAP[timeframe];
  if (!resolution) throw new Error(`Unsupported timeframe for Polygon Futures: ${timeframe}`);

  const fromMs = new Date(fromIso).getTime();
  const toMs   = new Date(toIso).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new Error(`Invalid date range: from=${fromIso}, to=${toIso}`);
  }

  // Polygon Futures expects window_start.gte/lte as ISO date or Unix ms.
  const params = new URLSearchParams({
    resolution,
    "window_start.gte": String(fromMs),
    "window_start.lte": String(toMs),
    limit: String(MAX_RESULTS),
    sort: "asc",
  });
  const url = `https://api.polygon.io/futures/v1/aggs/${encodeURIComponent(mapping.ticker)}?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Polygon Futures fetch timed out after 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* noop */ }
    if (r.status === 429) {
      throw new Error("Polygon rate limit exceeded (free tier: 5 req/min) — wait 60s or upgrade plan");
    }
    if (r.status === 403) {
      throw new Error(
        `Polygon Futures: subscription does not include futures data${body ? ` — ${body.slice(0, 200)}` : ""}`
      );
    }
    if (r.status === 401) {
      throw new Error("Polygon Futures: invalid API key");
    }
    throw new Error(`Polygon Futures fetch failed: HTTP ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await r.json()) as PolygonFuturesAggregateResponse;
  if (json.error) throw new Error(`Polygon Futures error: ${json.error}`);
  if (json.message && json.status !== "OK") {
    throw new Error(`Polygon Futures error: ${json.message}`);
  }

  const out: Bar[] = [];
  for (const row of json.results ?? []) {
    // Accept both naming conventions (v1 futures uses `window_start`; some
    // mocks/older endpoints use `t`).
    const ts = typeof row.window_start === "number" ? row.window_start
             : typeof row.t === "number" ? row.t
             : NaN;
    if (!Number.isFinite(ts)) continue;
    const open  = typeof row.open  === "number" ? row.open  : typeof row.o === "number" ? row.o : NaN;
    const high  = typeof row.high  === "number" ? row.high  : typeof row.h === "number" ? row.h : NaN;
    const low   = typeof row.low   === "number" ? row.low   : typeof row.l === "number" ? row.l : NaN;
    const close = typeof row.close === "number" ? row.close : typeof row.c === "number" ? row.c : NaN;
    if (![open, high, low, close].every(Number.isFinite)) continue;
    const volume = typeof row.volume === "number" ? row.volume
                 : typeof row.v === "number" ? row.v
                 : 0;
    out.push({
      ts: new Date(ts).toISOString(),
      open, high, low, close,
      volume,
      spread: null,
    });
  }
  return out;
}
