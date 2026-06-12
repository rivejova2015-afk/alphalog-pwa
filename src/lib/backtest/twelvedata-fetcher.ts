// Twelve Data time_series fetcher — generous free tier (800 req/day, 8 req/min)
// with global coverage: 250+ exchanges, stocks/forex/crypto/ETFs/indices.
//
//   TWELVEDATA_API_KEY — required. Free key at https://twelvedata.com/register
//                        (email-only signup, no GitHub OAuth issues).
//
// When TWELVEDATA_API_KEY is missing the fetcher throws cleanly — bars-loader
// treats as "source not configured" and walks to the next entry in the chain
// (Polygon/Massive → OANDA → Yahoo).
//
// Endpoint: GET /time_series?symbol={s}&interval={i}&start_date={d}&end_date={d}&apikey={k}
// Docs:     https://twelvedata.com/docs#time-series

import type { Bar, Timeframe } from "@/types/backtest";

export type TwelveDataAssetClass = "forex" | "crypto" | "stocks";

export interface TwelveDataSymbol {
  symbol: string;
  assetClass: TwelveDataAssetClass;
}

// Twelve Data uses slash notation for forex/crypto (`EUR/USD`, `BTC/USD`)
// and plain ticker for equities. Metals spot are exposed as forex pairs.
//
// Coverage in three categories. To add more symbols at a later date, the
// only requirement is that Twelve Data actually serves them — check by
// hitting /symbol_search?symbol=XYZ on their REST API.

const FOREX_PAIRS = new Set<string>([
  // ── G10 majors
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  // ── EUR crosses
  "EURJPY", "EURGBP", "EURAUD", "EURCHF", "EURCAD", "EURNZD",
  "EURNOK", "EURSEK", "EURPLN", "EURHUF", "EURCZK",
  // ── GBP crosses
  "GBPJPY", "GBPAUD", "GBPCAD", "GBPCHF", "GBPNZD",
  // ── AUD crosses
  "AUDJPY", "AUDCAD", "AUDCHF", "AUDNZD",
  // ── Other major crosses
  "CADJPY", "CHFJPY", "NZDJPY", "NZDCAD", "NZDCHF", "CADCHF",
  // ── USD against emerging / commodity-block currencies
  "USDMXN", "USDZAR", "USDTRY", "USDSEK", "USDNOK", "USDDKK",
  "USDPLN", "USDHUF", "USDCZK", "USDSGD", "USDHKD", "USDCNH",
  "USDTHB", "USDKRW", "USDINR", "USDILS", "USDBRL",
  // ── Spot metals (Twelve Data exposes via forex pair format)
  "XAUUSD", "XAGUSD", "XPTUSD", "XPDUSD",
  "XAUEUR", "XAUGBP", "XAUJPY", "XAUAUD",
]);

const CRYPTO_PAIRS = new Set<string>([
  // ── Top 10 by market cap
  "BTCUSD", "ETHUSD", "BNBUSD", "SOLUSD", "XRPUSD",
  "ADAUSD", "DOGEUSD", "AVAXUSD", "DOTUSD", "LINKUSD",
  // ── Layer-1 / smart-contract platforms
  "MATICUSD", "ATOMUSD", "NEARUSD", "ALGOUSD", "FTMUSD",
  "ICPUSD", "APTUSD", "SUIUSD", "INJUSD",
  // ── DeFi blue chips
  "UNIUSD", "AAVEUSD", "MKRUSD", "CRVUSD", "COMPUSD", "GRTUSD", "LDOUSD",
  // ── L2 / scaling
  "ARBUSD", "OPUSD", "STRKUSD", "IMXUSD",
  // ── Established alts
  "LTCUSD", "BCHUSD", "XLMUSD", "ETCUSD", "EOSUSD", "XMRUSD", "TRXUSD",
  // ── Meme / community
  "SHIBUSD", "PEPEUSD", "FLOKIUSD",
  // ── Gaming / metaverse
  "SANDUSD", "MANAUSD", "AXSUSD", "GALAUSD",
  // ── Storage / infra
  "FILUSD", "ARUSD", "RNDRUSD",
]);

const STOCK_TICKERS = new Set<string>([
  // ── Broad index ETFs
  "SPY", "QQQ", "IWM", "DIA", "VOO", "VTI", "VXUS", "VEA", "VWO", "EEM", "EFA",
  // ── Sector SPDR ETFs
  "XLK", "XLF", "XLE", "XLV", "XLP", "XLY", "XLI", "XLU", "XLB", "XLRE", "XLC",
  // ── Commodity / volatility ETFs (proxies for assets Twelve Data doesn't
  //    serve as futures contracts — useful for backtesting commodity strategies
  //    without going to Yahoo's =F continuation series).
  "GLD", "SLV", "USO", "UNG", "DBA", "DBC", "PDBC", "GDX", "GDXJ",
  // ── Volatility / leveraged
  "UVXY", "VIXY", "VXX", "SQQQ", "TQQQ", "SOXL", "SOXS", "TZA", "TNA",
  // ── Tech megacap
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA",
  "AMD", "INTC", "ORCL", "CRM", "ADBE", "NFLX", "AVGO", "CSCO", "IBM",
  "QCOM", "TXN", "MU", "ASML", "TSM",
  // ── Finance
  "JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP",
  "V", "MA", "PYPL", "SQ",
  // ── Healthcare
  "JNJ", "PFE", "UNH", "MRK", "LLY", "ABBV", "TMO", "ABT", "BMY", "AMGN",
  // ── Consumer / retail
  "WMT", "KO", "PEP", "MCD", "NKE", "SBUX", "COST",
  "HD", "LOW", "DIS", "BABA", "TGT", "EL",
  // ── Energy
  "XOM", "CVX", "COP", "SLB", "OXY", "MPC", "PSX",
  // ── Industrials
  "BA", "CAT", "DE", "GE", "HON", "UPS", "FDX", "LMT", "RTX",
  // ── Communication
  "T", "VZ", "CMCSA", "TMUS",
  // ── Auto / EV
  "F", "GM", "RIVN", "LCID",
  // ── Crypto-related equities
  "COIN", "MSTR", "RIOT", "MARA", "HOOD",
]);

// Twelve Data uses different interval strings than other providers — `1day`
// instead of `D1`, `1h` instead of `H1`, etc.
const INTERVAL_MAP: Record<Timeframe, string> = {
  M1:  "1min",
  M5:  "5min",
  M15: "15min",
  M30: "30min",
  H1:  "1h",
  H4:  "4h",
  D1:  "1day",
  W1:  "1week",
  MN1: "1month",
};

const FETCH_TIMEOUT_MS = 15_000;
// Twelve Data free tier hard-caps output at 5000 rows per request.
const MAX_RESULTS = 5000;

interface TwelveDataTimeSeriesResponse {
  status?: string;
  code?: number;
  message?: string;
  meta?: { symbol?: string; interval?: string };
  values?: Array<{
    datetime?: string;
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    volume?: string;
  }>;
}

/**
 * Map our internal symbol → Twelve Data symbol. Returns null for symbols
 * Twelve Data doesn't cover under our mapping (the registry skips the source).
 */
export function mapToTwelveDataSymbol(symbol: string): TwelveDataSymbol | null {
  const up = symbol.toUpperCase();
  if (FOREX_PAIRS.has(up)) {
    // EURUSD → EUR/USD, XAUUSD → XAU/USD
    return { symbol: `${up.slice(0, 3)}/${up.slice(3)}`, assetClass: "forex" };
  }
  if (CRYPTO_PAIRS.has(up)) {
    return { symbol: `${up.slice(0, 3)}/${up.slice(3)}`, assetClass: "crypto" };
  }
  if (STOCK_TICKERS.has(up)) return { symbol: up, assetClass: "stocks" };
  return null;
}

function getApiKey(): string | null {
  return process.env.TWELVEDATA_API_KEY?.trim() || null;
}

/**
 * Format a date as `YYYY-MM-DD HH:mm:ss` (Twelve Data's expected format).
 * Truncates to the second; sub-second precision is not supported by the API.
 */
function formatTwelveDataDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  // ISO uses T separator; Twelve Data wants space. Strip the trailing Z + ms.
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Fetch OHLCV bars from Twelve Data's time_series endpoint.
 *
 * Throws on:
 *   - Missing TWELVEDATA_API_KEY (caller treats as "source disabled")
 *   - Unsupported symbol (no mapping)
 *   - HTTP failure / API error
 *   - 429 rate limit (free tier: 8 req/min, 800 req/day)
 *   - Business errors returned with HTTP 200 but `status: "error"` body
 *
 * Returns [] when the request succeeds but Twelve Data has no bars in the
 * window. Bars are emitted oldest-first to match the engine's expectation.
 */
export async function fetchTwelveDataBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("TWELVEDATA_API_KEY not set");

  const mapping = mapToTwelveDataSymbol(symbol);
  if (!mapping) throw new Error(`No TwelveData mapping for symbol ${symbol}`);

  const interval = INTERVAL_MAP[timeframe];
  const startDate = formatTwelveDataDate(fromIso);
  const endDate   = formatTwelveDataDate(toIso);

  const params = new URLSearchParams({
    symbol: mapping.symbol,
    interval,
    start_date: startDate,
    end_date: endDate,
    outputsize: String(MAX_RESULTS),
    format: "JSON",
    order: "ASC",  // oldest first — matches engine input convention
    apikey: apiKey,
  });
  const url = `https://api.twelvedata.com/time_series?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("TwelveData fetch timed out after 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    let body = "";
    try { body = await r.text(); } catch { /* noop */ }
    if (r.status === 429) {
      throw new Error("TwelveData rate limit exceeded (free tier: 8 req/min, 800 req/day) — wait 60s or upgrade plan");
    }
    if (r.status === 401) {
      throw new Error("TwelveData: invalid API key");
    }
    throw new Error(`TwelveData fetch failed: HTTP ${r.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  const json = (await r.json()) as TwelveDataTimeSeriesResponse;
  // Twelve Data returns HTTP 200 with status:"error" for business errors
  // (rate limit per minute exceeded on credits, symbol not subscribed, etc).
  if (json.status === "error") {
    const msg = json.message || "unknown error";
    if (typeof json.code === "number" && (json.code === 429 || /limit/i.test(msg))) {
      throw new Error(`TwelveData rate limit / credit error: ${msg}`);
    }
    throw new Error(`TwelveData error: ${msg}`);
  }

  const out: Bar[] = [];
  for (const row of json.values ?? []) {
    if (!row.datetime || !row.open || !row.high || !row.low || !row.close) continue;
    const open  = Number(row.open);
    const high  = Number(row.high);
    const low   = Number(row.low);
    const close = Number(row.close);
    if (![open, high, low, close].every(Number.isFinite)) continue;
    // Twelve Data datetimes come without timezone — they're in the exchange's
    // local timezone. For forex/crypto that's UTC. For stocks it's America/
    // New_York. Treating all as UTC: small (≤4h) drift on intraday US-stock
    // bars vs broker chart, but consistent and acceptable for backtest seed.
    const dt = row.datetime.includes("T") ? row.datetime : row.datetime.replace(" ", "T");
    const tsMs = new Date(dt + "Z").getTime();
    if (!Number.isFinite(tsMs)) continue;
    out.push({
      ts: new Date(tsMs).toISOString(),
      open, high, low, close,
      volume: row.volume != null && Number.isFinite(Number(row.volume)) ? Number(row.volume) : 0,
      spread: null,
    });
  }
  return out;
}
