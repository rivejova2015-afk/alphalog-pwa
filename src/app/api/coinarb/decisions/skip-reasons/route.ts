import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ window: '24h', total: 0, byReason: [] });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('coinarb_decisions')
    .select('reason')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .eq('kind', 'SKIP')
    .gte('created_at', dayAgo)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
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
