/**
 * GET /api/cron/terminal/price-fetch
 * Schedule: every 5 minutes (* /5 * * * *)
 *
 * Fetches live prices for XAUUSD and US500 from Finnhub (primary)
 * with Alpha Vantage as fallback. Upserts into live_market_data.
 *
 * Security: x-cron-secret header or Authorization: Bearer
 * Finnhub: /quote?symbol=XAUUSD for gold, /quote?symbol=SPY for US500
 * AV fallback: GLOBAL_QUOTE for both
 */

import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from "@/lib/log";

const FETCH_TIMEOUT_MS = 8_000;

// Finnhub symbols
const FINNHUB_MAP: Record<string, string> = {
  XAUUSD: 'OANDA:XAU_USD',
  US500:  'SPY',
};

// Alpha Vantage symbols (fallback)
const AV_MAP: Record<string, string> = {
  XAUUSD: 'GLD',
  US500:  'SPY',
};

interface PriceResult {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  change_pct: number | null;
  source: string;
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

async function fetchFinnhub(asset: string, finnhubKey: string): Promise<PriceResult | null> {
  const fhSymbol = FINNHUB_MAP[asset];
  if (!fhSymbol) return null;

  try {
    const res = await fetchWithTimeout(
      `https://finnhub.io/api/v1/quote?symbol=${fhSymbol}&token=${finnhubKey}`,
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      c?: number; // current price
      o?: number; // open
      h?: number; // high
      l?: number; // low
      pc?: number; // previous close
    };

    const last = data.c ?? 0;
    if (!last) return null;

    const prevClose = data.pc ?? last;
    const change_pct = prevClose > 0 ? ((last - prevClose) / prevClose) * 100 : null;

    return {
      symbol:     asset,
      bid:        last * 0.9999, // Finnhub quote has no bid/ask spread — approximate
      ask:        last * 1.0001,
      last,
      change_pct: change_pct !== null ? parseFloat(change_pct.toFixed(4)) : null,
      source:     'finnhub',
    };
  } catch {
    return null;
  }
}

async function fetchAlphaVantage(asset: string, avKey: string): Promise<PriceResult | null> {
  const avSymbol = AV_MAP[asset];
  if (!avSymbol) return null;

  try {
    const res = await fetchWithTimeout(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${avSymbol}&apikey=${avKey}`,
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      'Global Quote'?: {
        '05. price'?: string;
        '09. change'?: string;
        '10. change percent'?: string;
      };
    };

    const quote = data['Global Quote'];
    if (!quote) return null;

    const last = parseFloat(quote['05. price'] ?? '0');
    if (!last) return null;

    const changePctStr = quote['10. change percent']?.replace('%', '') ?? null;
    const change_pct = changePctStr ? parseFloat(parseFloat(changePctStr).toFixed(4)) : null;

    return {
      symbol:     asset,
      bid:        last * 0.9999,
      ask:        last * 1.0001,
      last,
      change_pct,
      source:     'alphavantage',
    };
  } catch {
    return null;
  }
}

async function handlePriceFetch(request: NextRequest) {
  // Auth
  const expectedSecret = process.env.CRON_SECRET;
  const xCronSecret    = request.headers.get('x-cron-secret');
  const authHeader     = request.headers.get('authorization') ?? '';
  const bearerToken    = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token          = xCronSecret || bearerToken;

  let authorized = false;
  try {
    if (token && expectedSecret) {
      const a = Buffer.from(token);
      const b = Buffer.from(expectedSecret);
      authorized = a.length === b.length && timingSafeEqual(a, b);
    }
  } catch {
    authorized = false;
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const finnhubKey = process.env.FINNHUB_API_KEY ?? '';
  const avKey      = process.env.ALPHA_VANTAGE_API_KEY ?? '';

  const assets = ['XAUUSD', 'US500'] as const;
  const results: Array<{ asset: string; ok: boolean; source?: string }> = [];

  // Fetch both assets in parallel
  const priceResults = await Promise.all(
    assets.map(async (asset) => {
      // Try Finnhub first
      let price: PriceResult | null = finnhubKey
        ? await fetchFinnhub(asset, finnhubKey)
        : null;

      // Fallback to Alpha Vantage
      if (!price && avKey) {
        price = await fetchAlphaVantage(asset, avKey);
      }

      return { asset, price };
    })
  );

  // Upsert into live_market_data
  for (const { asset, price } of priceResults) {
    if (!price) {
      logError("CronTerminalPriceFetch", { component: "cron.terminal.price-fetch", message: "[price-fetch] No price for ${asset}" });
      results.push({ asset, ok: false });
      continue;
    }

    const { error } = await supabase
      .from('live_market_data')
      .upsert(
        {
          symbol:      asset,
          bid:         price.bid,
          ask:         price.ask,
          last:        price.last,
          source:      price.source,
          token_ok:    true,
          raw_payload: { change_pct: price.change_pct },
          received_at: new Date().toISOString(),
        },
        { onConflict: 'symbol' }
      );

    if (error) {
      logError("TerminalPrice", { component: "cron.terminal.price-fetch", message: `Upsert error for ${asset}: ${error.message}`, asset });
      results.push({ asset, ok: false });
    } else {
      results.push({ asset, ok: true, source: price.source });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export const GET  = handlePriceFetch;
export const POST = handlePriceFetch;
