import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { safeNumber } from '@/lib/coinarb/queries';

interface HeatCell {
  venue: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  count: number;
  notionalUsd: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({ venues: [], symbols: [], cells: [], totalNotionalUsd: 0 });
  }

  const { data, error } = await supabase
    .from('coinarb_positions')
    .select('market_slug, side, size_usd, status')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .eq('status', 'OPEN')
    .is('deleted_at', null)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cells = new Map<string, HeatCell>();
  const venues = new Set<string>();
  const symbols = new Set<string>();
  let totalNotional = 0;

  for (const p of data ?? []) {
    const [venueRaw, symbolRaw] = (p.market_slug || ':').split(':');
    const venue = venueRaw || 'unknown';
    const symbol = symbolRaw || venueRaw || 'unknown';
    const side: 'BUY' | 'SELL' = p.side === 'SELL' ? 'SELL' : 'BUY';
    const notional = safeNumber(p.size_usd) ?? 0;

    venues.add(venue);
    symbols.add(symbol);
    totalNotional += notional;

    const key = `${venue}|${symbol}|${side}`;
    const cur = cells.get(key) ?? { venue, symbol, side, count: 0, notionalUsd: 0 };
    cur.count += 1;
    cur.notionalUsd += notional;
    cells.set(key, cur);
  }

  return NextResponse.json(
    {
      venues: Array.from(venues).sort(),
      symbols: Array.from(symbols).sort(),
      cells: Array.from(cells.values()).map(c => ({ ...c, notionalUsd: round(c.notionalUsd, 2) })),
      totalNotionalUsd: round(totalNotional, 2),
    },
    { headers: { 'Cache-Control': 'private, max-age=10' } },
  );
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
