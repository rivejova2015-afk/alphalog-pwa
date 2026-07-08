import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';

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

  // coinarb_decisions is in-scope (own Postgres); the shim has no
  // `.range()` / count-with-`{count:'exact'}` / `.gte()`. Fetch the
  // shim-supported filters (eq/order), then apply the since-cutoff filter,
  // exact count, and offset/limit pagination in JS.
  const pg = getPgClient();
  let pgQuery = pg
    .from('coinarb_decisions')
    .select('id, kind, symbol, venue, reason, meta, created_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id);

  if (kind && ALLOWED_KINDS.has(kind)) pgQuery = pgQuery.eq('kind', kind);
  if (symbol) pgQuery = pgQuery.eq('symbol', symbol);
  if (venue === 'spot' || venue === 'perp') pgQuery = pgQuery.eq('venue', venue);

  pgQuery = pgQuery.order('created_at', { ascending: false });

  const { data: rawRows, error } = await pgQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (rawRows ?? []) as unknown as {
    id: string; kind: string; symbol: string | null; venue: string | null;
    reason: string | null; meta: unknown; created_at: string | Date;
  }[];

  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) {
      // Both sides go through `new Date(...).getTime()` — the pg driver
      // auto-parses `created_at` (timestamptz) into a Date at runtime, and a
      // bare `Date >= string` comparison silently always evaluates false.
      const sinceMs = d.getTime();
      rows = rows.filter((r) => new Date(r.created_at).getTime() >= sinceMs);
    }
  }

  const count = rows.length;
  const data = rows.slice(offset, offset + limit);

  const decisions = data.map((d) => ({
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
