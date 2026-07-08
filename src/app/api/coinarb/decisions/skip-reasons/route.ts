import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ window: '24h', total: 0, byReason: [] });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dayAgoMs = new Date(dayAgo).getTime();

  // coinarb_decisions is in-scope (own Postgres); the shim has no `.gte()` /
  // `.limit()`. `created_at` is selected purely to apply the cutoff in JS
  // (dropped before use below). Date comparison goes through
  // `new Date(...).getTime()` on both sides — the pg driver auto-parses
  // `created_at` (timestamptz) into a Date at runtime, and a bare
  // `Date >= string` comparison silently always evaluates false.
  const pg = getPgClient();
  const { data: rawRows, error } = await pg
    .from('coinarb_decisions')
    .select('reason, created_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .eq('kind', 'SKIP');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = ((rawRows ?? []) as unknown as { reason: string | null; created_at: string | Date }[])
    .filter((r) => new Date(r.created_at).getTime() >= dayAgoMs)
    .slice(0, 5000);

  const counts = new Map<string, number>();
  for (const row of data) {
    const reason = (row.reason ?? 'unknown').toString();
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  const byReason = Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(
    { window: '24h', total: data?.length ?? 0, byReason },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
