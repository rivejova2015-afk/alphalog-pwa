import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status') ?? 'open';
  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');

  let query = supabase
    .from('polyarb_positions')
    .select('id, market_slug, condition_id, outcome, side, entry_price, size_usd, pnl_usd, pnl_percent, status, opened_at, closed_at', { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1);

  if (status === 'open') {
    query = query.eq('status', 'OPEN');
  } else if (status === 'closed') {
    query = query.in('status', ['CLOSED', 'LIQUIDATED']);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 }, {
    headers: { 'Cache-Control': 'private, max-age=10, stale-while-revalidate=20' },
  });
}
