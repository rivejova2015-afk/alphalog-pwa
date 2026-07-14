import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { safeCompareTokens } from '@/lib/security/timing';
import { isMarketHours } from '@/lib/cme/market-hours';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run near market close (15:55–16:30 ET)
  const now = new Date();
  const pg = getPgClient();

  type ConnectionRow = { id: string; user_id: string; cme_account_id: string; daily_pnl_usd: number | null };

  const { data: connectionsRaw } = await pg
    .from('cme_connections')
    .select('id, user_id, cme_account_id, daily_pnl_usd')
    .eq('status', 'connected');

  const connections = (connectionsRaw ?? []) as unknown as ConnectionRow[];
  if (!connections.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const conn of connections) {
    // El shim no soporta `.limit()` (Ajuste de Task 2) — `.maybeSingle()` ya
    // toma result[0] sobre el resultado ordenado, equivalente a
    // `.limit(1).maybeSingle()` sin pérdida de comportamiento (mismo patrón
    // usado en Task 4 para `account/route.ts`).
    const { data: snapshot } = await pg
      .from('cme_equity_snapshots')
      .select('equity_usd, daily_pnl_usd, balance_usd')
      .eq('user_id', conn.user_id)
      .eq('cme_account_id', conn.cme_account_id)
      .order('snapshot_at', { ascending: false })
      .maybeSingle();

    const { data: acct } = await pg
      .from('algo_cme_accounts')
      .select('label')
      .eq('id', conn.cme_account_id)
      .maybeSingle();

    const { data: trades } = await pg
      .from('cme_trades_propfirm')
      .select('pnl_usd, direction')
      .eq('user_id', conn.user_id)
      .eq('cme_account_id', conn.cme_account_id)
      .gte('fill_timestamp', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
      .eq('status', 'closed');

    const snapshotRow = snapshot as { equity_usd: number; daily_pnl_usd: number; balance_usd: number } | null;
    const acctRow = acct as { label: string } | null;
    const tradeCount = (trades as unknown[] | null)?.length ?? 0;
    const pnl = Number(snapshotRow?.daily_pnl_usd ?? conn.daily_pnl_usd ?? 0);

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
          title: `CME Daily Report — ${acctRow?.label ?? 'Account'}`,
          body: `${tradeCount} trades | P&L: $${pnl.toFixed(2)} | Equity: $${Number(snapshotRow?.equity_usd ?? 0).toFixed(2)}`,
        }),
      }).catch(() => {});
    }

    sent++;
  }

  return NextResponse.json({ sent });
}
