import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { safeNumber } from '@/lib/coinarb/queries';

interface ReliabilityBin {
  bin: number;        // 0..9 — center bin index
  predicted: number;  // bin centre 0..1
  actual: number;     // empirical win rate
  count: number;
}

interface BucketAgg {
  count: number;
  brierSum: number;
  wins: number;
}

const BIN_COUNT = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({
      window: '7d',
      total: 0,
      brier: 0,
      reliability: [],
      byRegime: [],
      byTier: [],
    });
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('coinarb_calibration')
    .select('predicted_confidence, outcome, brier_score, regime, tier, closed_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .gte('closed_at', since)
    .order('closed_at', { ascending: true })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const total = rows.length;

  // Reliability bins
  const bins: Array<{ count: number; wins: number; sumPred: number }> = Array.from({ length: BIN_COUNT }, () => ({ count: 0, wins: 0, sumPred: 0 }));
  let brierSum = 0;
  const byRegime = new Map<string, BucketAgg>();
  const byTier = new Map<string, BucketAgg>();

  for (const r of rows) {
    const pred = safeNumber(r.predicted_confidence) ?? 0;
    const outcome = r.outcome === 1 ? 1 : 0;
    const brier = safeNumber(r.brier_score) ?? (pred - outcome) ** 2;

    brierSum += brier;
    const idx = Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(pred * BIN_COUNT)));
    bins[idx].count += 1;
    bins[idx].wins += outcome;
    bins[idx].sumPred += pred;

    const regimeKey = (typeof r.regime === 'string' && r.regime) ? r.regime : 'UNKNOWN';
    const tierKey = (typeof r.tier === 'string' && r.tier) ? r.tier : 'OTHER';
    bumpAgg(byRegime, regimeKey, brier, outcome);
    bumpAgg(byTier, tierKey, brier, outcome);
  }

  const reliability: ReliabilityBin[] = bins.map((b, i) => ({
    bin: i,
    predicted: b.count > 0 ? round(b.sumPred / b.count, 3) : round((i + 0.5) / BIN_COUNT, 3),
    actual: b.count > 0 ? round(b.wins / b.count, 3) : 0,
    count: b.count,
  }));

  return NextResponse.json(
    {
      window: '7d',
      total,
      brier: total > 0 ? round(brierSum / total, 4) : 0,
      reliability,
      byRegime: serializeMap(byRegime),
      byTier: serializeMap(byTier),
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

function bumpAgg(map: Map<string, BucketAgg>, key: string, brier: number, outcome: number): void {
  const cur = map.get(key) ?? { count: 0, brierSum: 0, wins: 0 };
  cur.count += 1;
  cur.brierSum += brier;
  cur.wins += outcome;
  map.set(key, cur);
}

function serializeMap(map: Map<string, BucketAgg>): Array<{ key: string; brier: number; winRate: number; count: number }> {
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      brier: v.count > 0 ? round(v.brierSum / v.count, 4) : 0,
      winRate: v.count > 0 ? round(v.wins / v.count, 3) : 0,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
