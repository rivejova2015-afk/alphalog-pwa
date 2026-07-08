import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';
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

  // coinarb_positions is in-scope (own Postgres); the shim has no `.limit()`,
  // so fetch matching rows and cap in JS.
  const pg = getPgClient();
  const { data: rawRows, error } = await pg
    .from('coinarb_positions')
    .select('symbol, direction, side, size_usd, status')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .eq('status', 'OPEN')
    .is('deleted_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = ((rawRows ?? []) as unknown as {
    symbol: string | null; direction: string | null; side: string | null; size_usd: number | string | null; status: string;
  }[]).slice(0, 500);

  const cells = new Map<string, HeatCell>();
  const venues = new Set<string>();
  const symbols = new Set<string>();
  let totalNotional = 0;

  // Spot-only bot: venue is constant 'spot', heatmap collapses to spot×{BTC,ETH,SOL}×{BUY,SELL}
  for (const p of data) {
    const venue = 'spot';
    const symbol = (typeof p.symbol === 'string' && p.symbol) ? p.symbol : 'unknown';
    const dir = p.direction ?? p.side;
    const side: 'BUY' | 'SELL' = dir === 'SELL' ? 'SELL' : 'BUY';
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
