import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { safeNumber } from '@/lib/coinarb/queries';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({ window: '24h', current: null, transitions: 0, points: [] });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('coinarb_regime_snapshots')
    .select('regime, agent_multiplier, trend, trend_strength, volatility_pct, consistency_score, previous_regime, is_transition, captured_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const points = rows.map(r => ({
    capturedAt: r.captured_at,
    regime: typeof r.regime === 'string' ? r.regime : 'UNKNOWN',
    multiplier: safeNumber(r.agent_multiplier) ?? 1,
    trend: typeof r.trend === 'string' ? r.trend : null,
    trendStrength: safeNumber(r.trend_strength) ?? 0,
    volatilityPct: safeNumber(r.volatility_pct) ?? 0,
    consistencyScore: safeNumber(r.consistency_score) ?? 0,
    previousRegime: typeof r.previous_regime === 'string' ? r.previous_regime : null,
    isTransition: r.is_transition === true,
  }));

  const transitions = points.filter(p => p.isTransition).length;
  const current = points.length > 0 ? points[points.length - 1] : null;

  return NextResponse.json(
    { window: '24h', transitions, current, points },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
