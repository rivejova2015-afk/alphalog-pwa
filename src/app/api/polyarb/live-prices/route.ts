import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';
const MAX_IDS = 10;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = request.nextUrl.searchParams.get('conditionIds') ?? '';
  const conditionIds = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  if (conditionIds.length === 0) {
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }

  const result: Record<string, { yesPrice: number; noPrice: number; timestamp: number } | null> = {};

  await Promise.all(conditionIds.map(async (id) => {
    try {
      const res = await fetch(`${GAMMA_BASE}/markets?condition_ids=${id}`, {
        headers: { 'User-Agent': 'alphalog-pwa/1.0' },
        signal: AbortSignal.timeout(4_000),
      });
      if (!res.ok) { result[id] = null; return; }

      const markets = await res.json() as Array<{ outcomePrices?: string; active?: boolean }>;
      const market = markets[0];
      if (!market?.outcomePrices) { result[id] = null; return; }

      const prices = JSON.parse(market.outcomePrices) as string[];
      const yesPrice = parseFloat(prices[0]);
      const noPrice = parseFloat(prices[1]);

      if (!isFinite(yesPrice) || !isFinite(noPrice)) { result[id] = null; return; }

      result[id] = { yesPrice, noPrice, timestamp: Date.now() };
    } catch {
      result[id] = null;
    }
  }));

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
