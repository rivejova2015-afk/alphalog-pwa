import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';

interface CoinarbPositionRow {
  id: string;
  symbol: string | null;
  direction: string | null;
  side: string | null;
  entry_price: number | string | null;
  exit_price: number | string | null;
  size_usd: number | string | null;
  base_qty: number | string | null;
  pnl_usd: number | string | null;
  pnl_percent: number | string | null;
  status: string;
  exit_reason: unknown;
  entry_reason: unknown;
  stop_loss_price: number | string | null;
  take_profit_price: number | string | null;
  smc_zone_type: string | null;
  smc_zone_price: number | string | null;
  arb_gap_pct: number | string | null;
  fear_greed_at_entry: number | string | null;
  phase_at_entry: string | null;
  opened_at: string | Date | null;
  closed_at: string | Date | null;
  created_at: string | Date;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ data: [], total: 0 });

  const status = request.nextUrl.searchParams.get('status') ?? 'open';
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');

  // coinarb_positions is in-scope (own Postgres); the shim has no `.range()`
  // / count-with-`{count:'exact'}` / `.in()`. Fetch the shim-supported
  // filters (eq/is/order), apply the status="closed" membership filter, the
  // exact count, and offset/limit pagination in JS.
  const pg = getPgClient();
  let pgQuery = pg
    .from('coinarb_positions')
    .select(
      'id, symbol, direction, side, entry_price, exit_price, size_usd, base_qty, pnl_usd, pnl_percent, status, exit_reason, entry_reason, stop_loss_price, take_profit_price, smc_zone_type, smc_zone_price, arb_gap_pct, fear_greed_at_entry, phase_at_entry, opened_at, closed_at, created_at',
    )
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('deleted_at', null);

  if (status === 'open') pgQuery = pgQuery.eq('status', 'OPEN');

  pgQuery = pgQuery.order('created_at', { ascending: false });

  const { data: rawRows, error } = await pgQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (rawRows ?? []) as unknown as CoinarbPositionRow[];
  if (status === 'closed') {
    rows = rows.filter((p) => p.status === 'CLOSED' || p.status === 'LIQUIDATED');
  }

  const count = rows.length;
  const data = rows.slice(offset, offset + limit);

  // Spot-only bot: venue is always 'spot', leverage is always 1×.
  const positions = data.map((p) => {
    const { entry_reason, exit_reason, ...rest } = p;
    return {
      ...rest,
      venue: 'spot' as const,
      leverageUsed: 1,
      exitReason: exit_reason ?? null,
      entryMeta: (entry_reason ?? {}) as Record<string, unknown>,
    };
  });

  return NextResponse.json(
    { data: positions, total: count ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' } },
  );
}
