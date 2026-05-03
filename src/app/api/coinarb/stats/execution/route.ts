import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { dayStartUtc, percentile, safeNumber } from '@/lib/coinarb/queries';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) {
    return NextResponse.json({
      slippage: { p50: 0, p95: 0, max: 0, count: 0 },
      latency: { p50: 0, p95: 0, max: 0, count: 0 },
      fees: { totalUsd: 0, count: 0, avgUsd: 0 },
      fills: 0,
    });
  }

  const start = dayStartUtc().toISOString();

  const { data, error } = await supabase
    .from('coinarb_trades')
    .select('slippage_bps, execution_latency_ms, fee_usd, trade_type, price')
    .eq('user_id', user.id)
    .eq('agent_id', agent.id)
    .gte('executed_at', start)
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const slips: number[] = [];
  const lats: number[] = [];
  let feeTotal = 0;
  let feeCount = 0;
  let fills = 0;

  for (const t of data ?? []) {
    const slip = safeNumber(t.slippage_bps);
    if (slip != null) slips.push(Math.abs(slip));
    const lat = safeNumber(t.execution_latency_ms);
    if (lat != null) lats.push(lat);
    const fee = safeNumber(t.fee_usd);
    if (fee != null && fee > 0) {
      feeTotal += fee;
      feeCount += 1;
    }
    const price = safeNumber(t.price);
    if ((t.trade_type ?? 'ENTRY') === 'ENTRY' && price != null && price > 0) fills += 1;
  }

  return NextResponse.json(
    {
      slippage: {
        p50: round(percentile(slips, 50), 2),
        p95: round(percentile(slips, 95), 2),
        max: round(slips.length ? Math.max(...slips) : 0, 2),
        count: slips.length,
      },
      latency: {
        p50: Math.round(percentile(lats, 50)),
        p95: Math.round(percentile(lats, 95)),
        max: lats.length ? Math.max(...lats) : 0,
        count: lats.length,
      },
      fees: {
        totalUsd: round(feeTotal, 2),
        count: feeCount,
        avgUsd: feeCount > 0 ? round(feeTotal / feeCount, 4) : 0,
      },
      fills,
    },
    { headers: { 'Cache-Control': 'private, max-age=15' } },
  );
}

function round(n: number, dp: number): number {
  const k = 10 ** dp;
  return Math.round(n * k) / k;
}
