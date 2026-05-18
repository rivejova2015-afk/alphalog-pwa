// OANDA v20 REST fetcher — real broker-quality forex bars without a CSV
// round-trip. Requires a (free) OANDA practice/live account token in env:
//
//   OANDA_API_TOKEN     — required. Bearer token from your v20 account page.
//   OANDA_ENV           — 'practice' (default) | 'live'. Picks the host.
//
// When OANDA_API_TOKEN is missing the fetcher throws a clean error that the
// bars-loader treats as "source not configured" → walks to the next entry in
// the registry chain (typically Yahoo). Setting the env var "enables" the
// source — no further config changes needed.
//
// Endpoint: GET /v3/instruments/{INSTRUMENT}/candles?...
// Docs:     https://developer.oanda.com/rest-live-v20/instrument-ep/

import type { Bar, Timeframe } from "@/types/backtest";

// Our symbols → OANDA instrument codes.
// OANDA uses BASE_QUOTE underscore notation (e.g. EUR_USD, XAU_USD, GBP_JPY).
const SYMBOL_MAP: Record<string, string> = {
  // Forex majors
  EURUSD: "EUR_USD", GBPUSD: "GBP_USD", USDJPY: "USD_JPY", USDCHF: "USD_CHF",
  AUDUSD: "AUD_USD", USDCAD: "USD_CAD", NZDUSD: "NZD_USD",
  // Crosses
  EURJPY: "EUR_JPY", GBPJPY: "GBP_JPY", EURGBP: "EUR_GBP", EURAUD: "EUR_AUD",
  EURCHF: "EUR_CHF", AUDJPY: "AUD_JPY", CADJPY: "CAD_JPY", CHFJPY: "CHF_JPY",
  // Metals (OANDA serves real spot — no GC=F proxy needed when this is wired)
  XAUUSD: "XAU_USD", XAGUSD: "XAG_USD",
};

const GRANULARITY_MAP: Record<Timeframe, string> = {
  M1: "M1", M5: "M5", M15: "M15", M30: "M30",
  H1: "H1", H4: "H4", D1: "D", W1: "W", MN1: "M",
};

interface OandaCandlesResponse {
  instrument?: string;
  granularity?: string;
  candles?: Array<{
    time: string;
    volume?: number;
    mid?:    { o?: string; h?: string; l?: string; c?: string };
    bid?:    { o?: string; h?: string; l?: string; c?: string };
    ask?:    { o?: string; h?: string; l?: string; c?: string };
    complete?: boolean;
  }>;
  errorMessage?: string;
}

const FETCH_TIMEOUT_MS = 15_000;

export function mapToOandaInstrument(symbol: string): string | null {
  return SYMBOL_MAP[symbol.toUpperCase()] ?? null;
}

function getEnv(): { token: string; host: string } | null {
  const token = process.env.OANDA_API_TOKEN?.trim();
  if (!token) return null;
  const isLive = (process.env.OANDA_ENV ?? "practice").toLowerCase() === "live";
  const host = isLive ? "api-fxtrade.oanda.com" : "api-fxpractice.oanda.com";
  return { token, host };
}

/**
 * Fetch OHLCV bars from OANDA v20. Always uses BID prices for consistency
 * with what a buy-side strategy would actually pay (the spread is in the
 * difference, but our backtest treats spread separately via algorithm config).
 *
 * Throws on:
 *   - Missing OANDA_API_TOKEN (caller treats as "source disabled")
 *   - Unsupported symbol (no mapping)
 *   - HTTP failure / API error
 *
 * Returns [] when OANDA accepts the request but returns no candles in the
 * window (the caller should treat as "empty response, try next source").
 */
export async function fetchOandaBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  const env = getEnv();
  if (!env) throw new Error("OANDA_API_TOKEN not set");

  const instrument = mapToOandaInstrument(symbol);
  if (!instrument) throw new Error(`No OANDA mapping for symbol ${symbol}`);

  const granularity = GRANULARITY_MAP[timeframe];
  // v20 expects RFC3339 dates with Z suffix.
  const fromQ = encodeURIComponent(fromIso);
  const toQ   = encodeURIComponent(toIso);
  const url = `https://${env.host}/v3/instruments/${instrument}/candles?price=B&granularity=${granularity}&from=${fromQ}&to=${toQ}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${env.token}`,
        Accept: "application/json",
        "Accept-Datetime-Format": "RFC3339",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OANDA fetch timed out after 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* noop */ }
    throw new Error(`OANDA fetch failed: HTTP ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const json = (await r.json()) as OandaCandlesResponse;
  if (json.errorMessage) throw new Error(`OANDA error: ${json.errorMessage}`);

  const out: Bar[] = [];
  for (const c of json.candles ?? []) {
    if (c.complete === false) continue;  // skip in-progress bars
    const ohlc = c.bid ?? c.mid ?? c.ask;  // we asked for bid, but accept any
    if (!ohlc) continue;
    const open  = Number(ohlc.o);
    const high  = Number(ohlc.h);
    const low   = Number(ohlc.l);
    const close = Number(ohlc.c);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    out.push({
      ts:     new Date(c.time).toISOString(),
      open, high, low, close,
      volume: typeof c.volume === "number" ? c.volume : 0,
      spread: null,
    });
  }
  return out;
}
