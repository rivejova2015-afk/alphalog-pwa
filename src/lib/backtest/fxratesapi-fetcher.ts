// fxratesapi.com fetcher — real spot prices for precious metals (XAU/XAG/
// XPT/XPD vs USD) without an API key.
//
// Trade-offs vs Yahoo's GC=F proxy:
//   + Real spot price (no futures basis ~$1-5)
//   + No auth, no rate-limit headaches
//   - D1 only (no intraday)
//   - One price per day, not OHLC → we synthesize a degenerate bar where
//     open=high=low=close (honest about the data limit; the engine's daily
//     levels module reads only the close anyway for PDH/PDL evaluation).
//   - 366-day history cap per call — we chunk for longer ranges.
//
// Lives in the API-source chain as a secondary backup to Yahoo: the
// source-registry puts Yahoo first (intraday + D1 via GC=F proxy), then this
// only fires when Yahoo returns 0 bars.

import type { Bar, Timeframe } from "@/types/backtest";

// Symbols → fxratesapi base/quote pair.
const SYMBOL_MAP: Record<string, { base: string; quote: string }> = {
  XAUUSD: { base: "XAU", quote: "USD" },
  XAGUSD: { base: "XAG", quote: "USD" },
  XPTUSD: { base: "XPT", quote: "USD" },
  XPDUSD: { base: "XPD", quote: "USD" },
};

export function mapToFxratesapiPair(symbol: string): { base: string; quote: string } | null {
  return SYMBOL_MAP[symbol.toUpperCase()] ?? null;
}

interface FxratesapiTimeseriesResponse {
  success: boolean;
  base?: string;
  rates?: Record<string, Record<string, number>>;
  error?: { code?: number; description?: string };
}

const MAX_DAYS_PER_CALL = 365;  // fxratesapi caps history at 366d per call
const FETCH_TIMEOUT_MS  = 15_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);  // YYYY-MM-DD
}

function planChunks(fromIso: string, toIso: string): { start: string; end: string }[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const chunks: { start: string; end: string }[] = [];
  let cursor = new Date(from);
  while (cursor.getTime() < to.getTime()) {
    const chunkEnd = new Date(Math.min(
      cursor.getTime() + MAX_DAYS_PER_CALL * 86_400_000,
      to.getTime(),
    ));
    chunks.push({ start: isoDate(cursor), end: isoDate(chunkEnd) });
    cursor = new Date(chunkEnd.getTime() + 86_400_000);
  }
  return chunks;
}

async function fetchChunk(base: string, quote: string, startDate: string, endDate: string): Promise<Record<string, Record<string, number>>> {
  const url = `https://api.fxratesapi.com/timeseries?start_date=${startDate}&end_date=${endDate}&base=${base}&currencies=${quote}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaLog-Backtest/1.0)",
        "Accept": "application/json",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("fxratesapi fetch timed out after 15s");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error(`fxratesapi fetch failed: HTTP ${r.status}`);
  const json = (await r.json()) as FxratesapiTimeseriesResponse;
  if (!json.success) {
    throw new Error(`fxratesapi error: ${json.error?.description ?? "unknown"}`);
  }
  return json.rates ?? {};
}

/**
 * Convert a price-only response into degenerate OHLC bars. Each entry is one
 * day; we set open=high=low=close=price to be transparent that this is a
 * single-point synthesis (not real OHLC). Timestamps are normalized to
 * `YYYY-MM-DDT00:00:00Z` so they collide cleanly on the PK if Yahoo data
 * for the same day was previously stored.
 */
function ratesToBars(rates: Record<string, Record<string, number>>, quote: string): Bar[] {
  const bars: Bar[] = [];
  for (const [tsRaw, perCurrency] of Object.entries(rates)) {
    const price = perCurrency?.[quote];
    if (typeof price !== "number" || !Number.isFinite(price)) continue;
    // fxratesapi returns timestamps like "2026-05-14T23:59:00.000Z" — normalize
    // to midnight UTC of the same calendar date.
    const datePart = tsRaw.slice(0, 10);
    const ts = `${datePart}T00:00:00.000Z`;
    bars.push({
      ts,
      open: price, high: price, low: price, close: price,
      volume: 0,
      spread: null,
    });
  }
  bars.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  // Dedup any same-ts duplicates (chunk boundaries can overlap).
  const dedup: Bar[] = [];
  for (const b of bars) {
    if (dedup.length === 0 || dedup[dedup.length - 1].ts !== b.ts) dedup.push(b);
  }
  return dedup;
}

/**
 * Public fetcher.
 * Throws on unsupported symbol, unsupported TF (anything other than D1),
 * network failure, or API error. Caller should treat exceptions as "source
 * failed, try next".
 */
export async function fetchFxratesapiBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  if (timeframe !== "D1") {
    throw new Error(`fxratesapi only supports D1 timeframe (got ${timeframe})`);
  }
  const pair = mapToFxratesapiPair(symbol);
  if (!pair) throw new Error(`No fxratesapi mapping for symbol ${symbol}`);

  const chunks = planChunks(fromIso, toIso);
  const allRates: Record<string, Record<string, number>> = {};
  for (const { start, end } of chunks) {
    const rates = await fetchChunk(pair.base, pair.quote, start, end);
    Object.assign(allRates, rates);
  }
  return ratesToBars(allRates, pair.quote);
}

// Exposed for tests so they can verify chunk planning without making network calls.
export const __testing = { planChunks, ratesToBars };
