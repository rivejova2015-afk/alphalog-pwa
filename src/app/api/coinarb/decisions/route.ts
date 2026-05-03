import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';

const ALLOWED_KINDS = new Set(['ENTER', 'SCALP', 'SKIP', 'EXIT', 'BREAKER', 'CASCADE', 'TICK']);

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ data: [], total: 0 });

  const params = request.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') ?? '100')));
  const offset = Math.max(0, parseInt(params.get('offset') ?? '0'));
  const kind = params.get('kind');
  const symbol = params.get('symbol');
  const venue = params.get('venue');
  const since = params.get('since');

  let query = supabase
    .from('coinarb_decisions')
    .select('id, kind, symbol, venue, reason, meta, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (kind && ALLOWED_KINDS.has(kind)) query = query.eq('kind', kind);
  if (symbol) query = query.eq('symbol', symbol);
  if (venue === 'spot' || venue === 'perp') query = query.eq('venue', venue);
  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) query = query.gte('created_at', d.toISOString());
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const decisions = (data ?? []).map((d) => ({
    id: d.id,
    kind: d.kind,
    symbol: d.symbol,
    venue: d.venue,
    reason: d.reason,
    meta: (d.meta ?? {}) as Record<string, unknown>,
    createdAt: d.created_at,
  }));

  return NextResponse.json(
    { data: decisions, total: count ?? 0 },
    { headers: { 'Cache-Control': 'private, max-age=3' } },
  );
}
