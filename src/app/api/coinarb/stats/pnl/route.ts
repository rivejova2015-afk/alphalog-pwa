import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';
import { dayStartUtc, safeNumber } from '@/lib/coinarb/queries';

interface Bucket {
  count: number;
  pnlUsd: number;
  wins: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({
      byVenue: {},
      bySymbol: [],
      byTier: {},
      cumulativeToday: [],
    });
  }

  // Spot-only bot: venue = 'spot', symbol is direct column. Tier still in entry_reason.
  // coinarb_positions is in-scope (own Postgres); the shim has no
  // `.not(col,'is',null)` / `.limit()`, so fetch ordered rows and apply both
  // in JS (order is preserved by the shim's SQL ORDER BY before we filter).
  const pg = getPgClient();
  const { data: closedRaw, error } = await pg
    .from('coinarb_positions')
    .select('symbol, pnl_usd, entry_reason, closed_at')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .is('deleted_at', null)
    .order('closed_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const closed = ((closedRaw ?? []) as unknown as {
    symbol: string | null; pnl_usd: number | string | null; entry_reason: unknown; closed_at: string | Date | null;
  }[])
    .filter((p) => p.closed_at !== null)
    .slice(0, 1000);

  const byVenue: Record<string, Bucket> = {};
  const bySymbol: Map<string, Bucket> = new Map();
  const byTier: Record<string, Bucket> = {};

  const dayStart = dayStartUtc().getTime();
  const cumulative: Array<{ at: string; cumPnlUsd: number }> = [];
  let runningToday = 0;

  for (const p of closed) {
    const pnl = safeNumber(p.pnl_usd) ?? 0;
    const symbol = (typeof p.symbol === 'string' && p.symbol) ? p.symbol : 'unknown';
    const meta = (p.entry_reason ?? {}) as Record<string, unknown>;
    const tier = typeof meta.tier === 'string' ? meta.tier : 'OTHER';

    bumpBucket(byVenue, 'spot', pnl);
    bumpBucket(byTier, tier, pnl);

    const sym = bySymbol.get(symbol) ?? { count: 0, pnlUsd: 0, wins: 0 };
    sym.count += 1;
    sym.pnlUsd += pnl;
    if (pnl > 0) sym.wins += 1;
    bySymbol.set(symbol, sym);

    const closedAt = p.closed_at ? new Date(p.closed_at).getTime() : NaN;
    if (Number.isFinite(closedAt) && closedAt >= dayStart) {
      runningToday += pnl;
      cumulative.push({ at: new Date(closedAt).toISOString(), cumPnlUsd: round(runningToday, 4) });
    }
  }

  return NextResponse.json(
    {
      byVenue: serializeRecord(byVenue),
      bySymbol: Array.from(bySymbol.entries())
        .map(([symbol, b]) => ({ symbol, ...serialize(b) }))
        .sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd)),
      byTier: serializeRecord(byTier),
      cumulativeToday: cumulative,
    },
    { headers: { 'Cache-Control': 'private, max-age=15' } },
  );
}

function bumpBucket(record: Record<string, Bucket>, key: string, pnl: number): void {
  const b = record[key] ?? { count: 0, pnlUsd: 0, wins: 0 };
  b.count += 1;
  b.pnlUsd += pnl;
  if (pnl > 0) b.wins += 1;
  record[key] = b;
}

function serialize(b: Bucket): { count: number; pnlUsd: number; winRate: number } {
  return {
    count: b.count,
    pnlUsd: round(b.pnlUsd, 2),
    winRate: b.count > 0 ? round(b.wins / b.count, 4) : 0,
  };
}

function serializeRecord(record: Record<string, Bucket>): Record<string, ReturnType<typeof serialize>> {
  const out: Record<string, ReturnType<typeof serialize>> = {};
  for (const [k, v] of Object.entries(record)) out[k] = serialize(v);
  return out;
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
