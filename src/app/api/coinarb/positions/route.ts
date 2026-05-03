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
      'id, market_slug, condition_id, outcome, side, entry_price, exit_price, size_usd, shares, pnl_usd, pnl_percent, status, exit_reason, opened_at, closed_at, created_at',
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

  // Decode market_slug "venue:symbol" → { venue, symbol }
  const positions = (data ?? []).map((p) => {
    const [venue, symbol] = (p.market_slug || ':').split(':');
    return { ...p, venue: venue || 'unknown', symbol: symbol || p.market_slug };
  });

  return NextResponse.json(
    { data: positions, total: count ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' } },
  );
}
