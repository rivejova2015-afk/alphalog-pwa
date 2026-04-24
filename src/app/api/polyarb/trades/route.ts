import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');

  const { data, error, count } = await supabase
    .from('polyarb_trades')
    .select(`
      id,
      side,
      price,
      size,
      fee_usd,
      status,
      executed_at,
      position:polyarb_positions!position_id (
        market_slug,
        outcome,
        pnl_usd,
        size_usd
      )
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten the nested position relation into the trade record
  const trades = (data ?? []).map((t) => {
    const pos = Array.isArray(t.position) ? t.position[0] : t.position;
    const priceNum = typeof t.price === 'string' ? parseFloat(t.price) : (t.price ?? 0);
    const sizeNum = typeof t.size === 'string' ? parseFloat(t.size) : (t.size ?? 0);
    return {
      id: t.id,
      market_slug: pos?.market_slug ?? '—',
      outcome: pos?.outcome ?? '—',
      side: t.side,
      price: priceNum,
      size_usd: pos?.size_usd ?? (priceNum > 0 && sizeNum > 0 ? priceNum * sizeNum : null),
      fee_usd: t.fee_usd,
      pnl_usd: pos?.pnl_usd ?? null,
      status: t.status,
      executed_at: t.executed_at,
    };
  });

  return NextResponse.json({ data: trades, total: count ?? 0 });
}
