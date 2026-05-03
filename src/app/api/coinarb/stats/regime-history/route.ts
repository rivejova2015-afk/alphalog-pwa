import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { hourStartUtc } from '@/lib/coinarb/queries';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({ window: '24h', byRegime: [], timeline: [] });
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('coinarb_decisions')
    .select('kind, meta, created_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .in('kind', ['ENTER', 'SCALP'])
    .gte('created_at', dayAgo)
    .order('created_at', { ascending: true })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byRegime = new Map<string, number>();
  const timeline = new Map<string, Map<string, number>>();
  let total = 0;

  for (const d of data ?? []) {
    const meta = (d.meta ?? {}) as Record<string, unknown>;
    const regime = typeof meta.regime === 'string' && meta.regime ? meta.regime : 'UNKNOWN';
    byRegime.set(regime, (byRegime.get(regime) ?? 0) + 1);
    total += 1;

    const hour = hourStartUtc(d.created_at).toISOString();
    const bucket = timeline.get(hour) ?? new Map<string, number>();
    bucket.set(regime, (bucket.get(regime) ?? 0) + 1);
    timeline.set(hour, bucket);
  }

  const byRegimeArr = Array.from(byRegime.entries())
    .map(([regime, count]) => ({
      regime,
      count,
      share: total > 0 ? Math.round((count / total) * 10_000) / 10_000 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const timelineArr: Array<{ hour: string; regime: string; count: number }> = [];
  const sortedHours = Array.from(timeline.keys()).sort();
  for (const hour of sortedHours) {
    const bucket = timeline.get(hour)!;
    for (const [regime, count] of bucket.entries()) {
      timelineArr.push({ hour, regime, count });
    }
  }

  return NextResponse.json(
    { window: '24h', total, byRegime: byRegimeArr, timeline: timelineArr },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
