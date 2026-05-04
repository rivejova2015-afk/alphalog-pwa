import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ data: [], total: 0 });

  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');
  const tradeType = request.nextUrl.searchParams.get('type');

  let query = supabase
    .from('coinarb_trades')
    .select(
      'id, position_id, trade_type, symbol, direction, side, price, size, size_usd, fee_usd, pnl_usd, slippage_bps, execution_latency_ms, status, executed_at',
      { count: 'exact' },
    )
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('archived_at', null)
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (tradeType) query = query.eq('trade_type', tradeType);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const trades = (data ?? []).map((t) => {
    const priceNum = typeof t.price === 'string' ? parseFloat(t.price) : (t.price ?? 0);
    const sizeNum = typeof t.size === 'string' ? parseFloat(t.size) : (t.size ?? 0);
    return {
      id: t.id,
      position_id: t.position_id ?? null,
      trade_type: t.trade_type ?? 'ENTRY',
      venue: 'spot' as const,
      symbol: t.symbol ?? 'unknown',
      direction: t.direction ?? t.side,
      side: t.side,
      price: priceNum,
      size: sizeNum,
      size_usd: t.size_usd ?? (priceNum > 0 && sizeNum > 0 ? priceNum * sizeNum : null),
      fee_usd: t.fee_usd,
      pnl_usd: t.pnl_usd,
      slippage_bps: t.slippage_bps ?? null,
      execution_latency_ms: t.execution_latency_ms ?? null,
      status: t.status,
      executed_at: t.executed_at,
    };
  });

  return NextResponse.json({ data: trades, total: count ?? 0 });
}
