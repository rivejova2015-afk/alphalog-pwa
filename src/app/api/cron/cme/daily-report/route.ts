import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompareTokens } from '@/lib/security/timing';
import { isMarketHours } from '@/lib/cme/market-hours';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run near market close (15:55–16:30 ET)
  const now = new Date();
  const svc = createServiceClient();

  const { data: connections } = await svc
    .from('cme_connections')
    .select('id, user_id, cme_account_id, daily_pnl_usd')
    .eq('status', 'connected');

  if (!connections?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const conn of connections) {
    const { data: snapshot } = await svc
      .from('cme_equity_snapshots')
      .select('equity_usd, daily_pnl_usd, balance_usd')
      .eq('user_id', conn.user_id)
      .eq('cme_account_id', conn.cme_account_id)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: acct } = await svc
      .from('algo_cme_accounts')
      .select('label')
      .eq('id', conn.cme_account_id)
      .maybeSingle();

    const { data: trades } = await svc
      .from('cme_trades_propfirm')
      .select('pnl_usd, direction')
      .eq('user_id', conn.user_id)
      .eq('cme_account_id', conn.cme_account_id)
      .gte('fill_timestamp', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
      .eq('status', 'closed');

    const tradeCount = trades?.length ?? 0;
    const pnl = Number(snapshot?.daily_pnl_usd ?? conn.daily_pnl_usd ?? 0);

    const pushUrl = process.env.ALPHALOG_PUSH_NOTIFY_URL;
    const pushToken = process.env.ALPHALOG_PUSH_NOTIFY_TOKEN;

    if (pushUrl && pushToken) {
      await fetch(pushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pushToken}`,
        },
        body: JSON.stringify({
          userId: conn.user_id,
          title: `CME Daily Report — ${acct?.label ?? 'Account'}`,
          body: `${tradeCount} trades | P&L: $${pnl.toFixed(2)} | Equity: $${Number(snapshot?.equity_usd ?? 0).toFixed(2)}`,
        }),
      }).catch(() => {});
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
