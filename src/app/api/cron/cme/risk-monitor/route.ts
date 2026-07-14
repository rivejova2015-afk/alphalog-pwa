import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { safeCompareTokens } from '@/lib/security/timing';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pg = getPgClient();

  type ConnectionRow = { id: string; user_id: string; cme_account_id: string; daily_pnl_usd: number | null };

  const { data: connectionsRaw } = await pg
    .from('cme_connections')
    .select('id, user_id, cme_account_id, daily_pnl_usd')
    .eq('status', 'connected');

  const connections = (connectionsRaw ?? []) as unknown as ConnectionRow[];
  if (!connections.length) return NextResponse.json({ checked: 0 });

  let triggered = 0;

  for (const conn of connections) {
    const [riskRes, accountRes] = await Promise.all([
      pg
        .from('cme_risk_configs')
        .select('id, enabled, circuit_breaker_pct')
        .eq('user_id', conn.user_id)
        .eq('cme_account_id', conn.cme_account_id)
        .maybeSingle(),
      pg
        .from('algo_cme_accounts')
        .select('max_daily_loss, label')
        .eq('id', conn.cme_account_id)
        .maybeSingle(),
    ]);

    const risk = riskRes.data as { id: string; enabled: boolean; circuit_breaker_pct: number | null } | null;
    const account = accountRes.data as { max_daily_loss: number | null; label: string } | null;

    if (!risk || !account || !risk.enabled) continue;

    const dailyPnl = Number(conn.daily_pnl_usd ?? 0);
    const maxLoss = Number(account.max_daily_loss ?? 0);
    if (!maxLoss) continue;

    const cbThreshold = maxLoss * (Number(risk.circuit_breaker_pct ?? 80) / 100);
    const isViolation = dailyPnl <= -maxLoss;
    const isCbTriggered = dailyPnl <= -cbThreshold;

    if (isCbTriggered) {
      await pg
        .from('cme_risk_configs')
        .update({
          enabled: false,
          paused_reason: isViolation ? 'violation' : 'circuit_breaker',
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', risk.id);

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
            title: isViolation ? 'CME: Max Loss Violation' : 'CME: Circuit Breaker Triggered',
            body: `${account.label}: Daily PnL ${dailyPnl.toFixed(2)} hit ${isViolation ? 'max loss' : 'circuit breaker'}. Trading paused.`,
          }),
        }).catch(() => {});
      }

      triggered++;
    }
  }

  return NextResponse.json({ checked: connections.length, triggered });
}
