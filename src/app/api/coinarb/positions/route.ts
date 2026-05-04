import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ data: [], total: 0 });

  const status = request.nextUrl.searchParams.get('status') ?? 'open';
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');

  let query = supabase
    .from('coinarb_positions')
    .select(
      'id, symbol, direction, side, entry_price, exit_price, size_usd, base_qty, pnl_usd, pnl_percent, status, exit_reason, entry_reason, stop_loss_price, take_profit_price, smc_zone_type, smc_zone_price, arb_gap_pct, fear_greed_at_entry, phase_at_entry, opened_at, closed_at, created_at',
      { count: 'exact' },
    )
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (status === 'open') query = query.eq('status', 'OPEN');
  else if (status === 'closed') query = query.in('status', ['CLOSED', 'LIQUIDATED']);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Spot-only bot: venue is always 'spot', leverage is always 1×.
  const positions = (data ?? []).map((p) => {
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
