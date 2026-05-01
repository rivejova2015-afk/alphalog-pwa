import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const SETTLED_REASONS = ['settled_win', 'settled_loss', 'settlement_timeout'];

interface GammaMarket {
  outcomePrices: string;
  closed: boolean;
}

async function fetchGammaMarket(marketSlug: string): Promise<GammaMarket | null> {
  try {
    const res = await fetch(
      `${GAMMA_BASE}/events?slug=${encodeURIComponent(marketSlug)}`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
    );
    if (!res.ok) return null;
    const events = await res.json() as Array<{ markets?: GammaMarket[] }>;
    return events[0]?.markets?.[0] ?? null;
  } catch {
    return null;
  }
}

function parseWinner(outcomePrices: string, outcome: 'YES' | 'NO'): boolean | null {
  let prices: string[];
  try {
    prices = JSON.parse(outcomePrices) as string[];
  } catch {
    return null;
  }
  if (prices.length < 2) return null;
  // Resolved when any price is near 0 or 1
  const resolved = prices.some(p => parseFloat(p) > 0.9 || parseFloat(p) < 0.05);
  if (!resolved) return null;
  // btc-updown-5m: index 0 = Up = YES, index 1 = Down = NO
  const idx = outcome === 'YES' ? 0 : 1;
  return parseFloat(prices[idx]) > 0.5;
}

function calcPnl(won: boolean, shares: number, sizeUsd: number): number {
  return won ? (shares - sizeUsd) : -sizeUsd;
}

// ── GET — estado de liquidaciones pendientes ─────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [pendingRes, settledRes] = await Promise.all([
    supabase
      .from('polyarb_positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('status', ['CLOSED', 'LIQUIDATED'])
      .not('exit_reason', 'in', `(${SETTLED_REASONS.map(r => `"${r}"`).join(',')})`),
    supabase
      .from('polyarb_positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .in('exit_reason', SETTLED_REASONS),
  ]);

  return NextResponse.json({
    pending: pendingRes.count ?? 0,
    settled: settledRes.count ?? 0,
  });
}

// ── POST — ejecutar sweep de liquidación ──────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('polyarb_positions')
    .select('id, market_slug, outcome, shares, size_usd, exit_reason')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .in('status', ['CLOSED', 'LIQUIDATED'])
    .not('exit_reason', 'in', `(${SETTLED_REASONS.map(r => `"${r}"`).join(',')})`)
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const positions = (data ?? []) as Array<{
    id: string;
    market_slug: string;
    outcome: 'YES' | 'NO';
    shares: number | string;
    size_usd: number | string;
    exit_reason: string | null;
  }>;

  const results: Array<{
    positionId: string;
    marketSlug: string;
    outcome: string;
    won: boolean | null;
    pnlUsd: number;
    skipped: boolean;
    reason: string;
  }> = [];

  for (const pos of positions) {
    const shares = Number(pos.shares);
    const sizeUsd = Number(pos.size_usd);

    try {
      const market = await fetchGammaMarket(pos.market_slug);

      if (!market) {
        results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: 'gamma_unavailable' });
        continue;
      }

      const won = parseWinner(market.outcomePrices, pos.outcome);

      if (won === null) {
        results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: 'not_resolved_yet' });
        continue;
      }

      const pnlUsd = calcPnl(won, shares, sizeUsd);
      const exitReason = won ? 'settled_win' : 'settled_loss';
      const exitPrice = won ? 1 : 0;

      await supabase
        .from('polyarb_positions')
        .update({ pnl_usd: pnlUsd, exit_reason: exitReason, exit_price: exitPrice })
        .eq('id', pos.id);

      await supabase
        .from('polyarb_trades')
        .update({ pnl_usd: pnlUsd })
        .eq('position_id', pos.id)
        .eq('trade_type', 'EXIT');

      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won, pnlUsd, skipped: false, reason: exitReason });
    } catch (err) {
      results.push({ positionId: pos.id, marketSlug: pos.market_slug, outcome: pos.outcome, won: null, pnlUsd: 0, skipped: true, reason: `error: ${err instanceof Error ? err.message : String(err)}` });
    }

    // Throttle gamma API
    await new Promise(r => setTimeout(r, 400));
  }

  const settled = results.filter(r => !r.skipped);
  const wins = settled.filter(r => r.won === true);
  const losses = settled.filter(r => r.won === false);

  return NextResponse.json({
    swept: settled.length,
    wins: wins.length,
    losses: losses.length,
    totalPnlUsd: settled.reduce((s, r) => s + r.pnlUsd, 0),
    results,
  });
}
