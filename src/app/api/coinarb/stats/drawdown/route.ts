import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { safeNumber } from '@/lib/coinarb/queries';

const WINDOW_DAYS = 14;
const MAX_POINTS = 600;

/**
 * Underwater equity curve.
 *
 * coinarb_telemetry is a single upserted row per agent (no history), so we
 * derive the equity curve by walking closed positions in chronological order:
 *   equity_t = starting_capital + Σ pnl_usd up to t
 * then track running peak and compute drawdownPct = (peak - equity) / peak.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({ window: `${WINDOW_DAYS}d`, points: [], maxDrawdownPct: 0, currentDrawdownPct: 0, startCapital: 0 });
  }

  const startCapital = Number(agent.starting_capital_usd ?? 0) || 0;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('coinarb_positions')
    .select('pnl_usd, closed_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('deleted_at', null)
    .not('closed_at', 'is', null)
    .gte('closed_at', since)
    .order('closed_at', { ascending: true })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  if (rows.length === 0 || startCapital <= 0) {
    return NextResponse.json({ window: `${WINDOW_DAYS}d`, points: [], maxDrawdownPct: 0, currentDrawdownPct: 0, startCapital });
  }

  let equity = startCapital;
  let peak = startCapital;
  let maxDd = 0;
  const raw: Array<{ at: string; equity: number; peak: number; ddPct: number }> = [
    { at: rows[0].closed_at as string, equity: round(equity, 2), peak: round(peak, 2), ddPct: 0 },
  ];

  for (const r of rows) {
    const pnl = safeNumber(r.pnl_usd) ?? 0;
    equity += pnl;
    if (equity > peak) peak = equity;
    const ddPct = peak > 0 ? (peak - equity) / peak : 0;
    if (ddPct > maxDd) maxDd = ddPct;
    raw.push({
      at: r.closed_at as string,
      equity: round(equity, 2),
      peak: round(peak, 2),
      ddPct: round(ddPct, 4),
    });
  }

  const points = decimate(raw, MAX_POINTS);
  const last = points[points.length - 1];

  return NextResponse.json(
    {
      window: `${WINDOW_DAYS}d`,
      points,
      maxDrawdownPct: round(maxDd, 4),
      currentDrawdownPct: last.ddPct,
      startCapital: round(startCapital, 2),
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}

function decimate<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: T[] = [];
  for (let i = 0; i < target; i++) out.push(arr[Math.floor(i * step)]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
