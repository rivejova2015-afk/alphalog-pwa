// Polygon.io aggregates fetcher — free-tier (5 req/min) source for stocks,
// forex (incl. metals) and crypto. Real-time crypto + forex (no delay),
// 15-min delayed stocks. Wider coverage than Yahoo and more reliable.
//
//   POLYGON_API_KEY — required. Get one at https://polygon.io/dashboard/api-keys
//                     Free tier covers our use cases for backtest seed.
//
// When POLYGON_API_KEY is missing the fetcher throws a clean error that the
// bars-loader treats as "source not configured" → walks to the next entry in
// the registry chain (typically OANDA or Yahoo).
//
// Endpoint: GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
// Docs:     https://polygon.io/docs/rest/stocks/aggregates/custom-bars

import type { Bar, Timeframe } from "@/types/backtest";

export type PolygonAssetClass = "forex" | "crypto" | "stocks";

export interface PolygonTicker {
  ticker: string;
  assetClass: PolygonAssetClass;
}

// Polygon prefix convention: C:EURUSD for forex, X:BTCUSD for crypto, plain
// for equities. Metals spot is exposed by Polygon as forex pairs (C:XAUUSD).
const FOREX_PAIRS = new Set<string>([
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURJPY", "GBPJPY", "EURGBP", "EURAUD", "EURCHF", "AUDJPY", "CADJPY", "CHFJPY",
  "XAUUSD", "XAGUSD",
]);

const CRYPTO_PAIRS = new Set<string>([
  "BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD",
]);

const STOCK_TICKERS = new Set<string>([
  "SPY", "QQQ", "IWM", "DIA",
  "AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "NFLX",
  "AMD", "INTC", "BABA", "DIS",
]);

const GRANULARITY_MAP: Record<Timeframe, { multiplier: number; timespan: string }> = {
  M1:  { multiplier: 1,  timespan: "minute" },
  M5:  { multiplier: 5,  timespan: "minute" },
  M15: { multiplier: 15, timespan: "minute" },
  M30: { multiplier: 30, timespan: "minute" },
  H1:  { multiplier: 1,  timespan: "hour" },
  H4:  { multiplier: 4,  timespan: "hour" },
  D1:  { multiplier: 1,  timespan: "day" },
  W1:  { multiplier: 1,  timespan: "week" },
  MN1: { multiplier: 1,  timespan: "month" },
};

// Polygon's hard cap per request. Free tier respects this too.
const MAX_RESULTS = 50_000;
const FETCH_TIMEOUT_MS = 15_000;

interface PolygonAggregateResponse {
  status?: string;
  error?: string;
  results?: Array<{
    t?: number;  // Unix ms timestamp (start of bar)
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;  // volume
  }>;
}

/**
 * Map our internal symbol → Polygon ticker. Returns null for symbols Polygon
 * doesn't cover (the registry will skip the source).
 */
export function mapToPolygonTicker(symbol: string): PolygonTicker | null {
  const up = symbol.toUpperCase();
  if (FOREX_PAIRS.has(up)) return { ticker: `C:${up}`, assetClass: "forex" };
  if (CRYPTO_PAIRS.has(up)) return { ticker: `X:${up}`, assetClass: "crypto" };
  if (STOCK_TICKERS.has(up)) return { ticker: up, assetClass: "stocks" };
  return null;
}

function getApiKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || null;
}

/**
 * Fetch OHLCV bars from Polygon.io's aggregates endpoint.
 *
 * Throws on:
 *   - Missing POLYGON_API_KEY (caller treats as "source disabled")
 *   - Unsupported symbol (no mapping)
 *   - HTTP failure / API error
 *   - 429 rate limit (with hint about free-tier limits)
 *
 * Returns [] when the request succeeds but Polygon has no bars in the window
 * (typical for weekends on forex or pre-IPO ranges on stocks).
 */
export async function fetchPolygonBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");

  const mapping = mapToPolygonTicker(symbol);
  if (!mapping) throw new Error(`No Polygon mapping for symbol ${symbol}`);

  const granularity = GRANULARITY_MAP[timeframe];
  // Polygon accepts both YYYY-MM-DD strings and Unix ms timestamps. Using ms
  // for precision on intraday windows (a YYYY-MM-DD "from" snaps to 00:00 UTC
  // which can drop the first bar of an intraday query).
  const fromMs = new Date(fromIso).getTime();
  const toMs   = new Date(toIso).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new Error(`Invalid date range: from=${fromIso}, to=${toIso}`);
  }

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(mapping.ticker)}` +
    `/range/${granularity.multiplier}/${granularity.timespan}/${fromMs}/${toMs}` +
    `?adjusted=true&sort=asc&limit=${MAX_RESULTS}`;

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
      throw new Error("Polygon fetch timed out after 15s");
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
        `Polygon: subscription does not include this data${body ? ` — ${body.slice(0, 200)}` : ""}`
      );
    }
    throw new Error(`Polygon fetch failed: HTTP ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await r.json()) as PolygonAggregateResponse;
  if (json.error) throw new Error(`Polygon error: ${json.error}`);

  const out: Bar[] = [];
  for (const row of json.results ?? []) {
    if (typeof row.t !== "number" || !Number.isFinite(row.t)) continue;
    const open  = typeof row.o === "number" ? row.o : NaN;
    const high  = typeof row.h === "number" ? row.h : NaN;
    const low   = typeof row.l === "number" ? row.l : NaN;
    const close = typeof row.c === "number" ? row.c : NaN;
    if (![open, high, low, close].every(Number.isFinite)) continue;
    out.push({
      ts: new Date(row.t).toISOString(),
      open, high, low, close,
      volume: typeof row.v === "number" ? row.v : 0,
      spread: null,
    });
  }
  return out;
}
