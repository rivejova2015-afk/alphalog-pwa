/**
 * GET /api/terminal/live-price?symbol=XAUUSD|US500
 * Returns the latest live price from live_market_data table.
 * stale=true if data is older than 15 minutes.
 * Cache: public, max-age=30, stale-while-revalidate=60
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');

  if (symbol !== 'XAUUSD' && symbol !== 'US500') {
    return NextResponse.json(
      { error: 'symbol must be XAUUSD or US500' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('live_market_data')
    .select('bid, ask, last, source, received_at')
    .eq('symbol', symbol)
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: 'No price data available' },
      { status: 404 }
    );
  }

  const receivedAt = new Date(data.received_at);
  const ageMs = Date.now() - receivedAt.getTime();
  const stale = ageMs > STALE_THRESHOLD_MS;

  // Compute change_pct from bid vs last (approximation — no previous close in table)
  const last = Number(data.last) || 0;
  const bid  = Number(data.bid)  || 0;
  const ask  = Number(data.ask)  || 0;

  // If the source provides a change, it may be in raw_payload; skip for now
  const change_pct: number | null = null;

  return NextResponse.json(
    {
      symbol,
      last,
      bid,
      ask,
      change_pct,
      source:      data.source ?? 'unknown',
      received_at: data.received_at,
      stale,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    }
  );
}
