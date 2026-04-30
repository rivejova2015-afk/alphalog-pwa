import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompareTokens } from '@/lib/security/timing';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: connections } = await svc
    .from('cme_connections')
    .select('id, user_id, cme_account_id, daily_pnl_usd')
    .eq('status', 'connected');

  if (!connections?.length) return NextResponse.json({ checked: 0 });

  let triggered = 0;

  for (const conn of connections) {
    const [riskRes, accountRes] = await Promise.all([
      svc
        .from('cme_risk_configs')
        .select('id, enabled, circuit_breaker_pct')
        .eq('user_id', conn.user_id)
        .eq('cme_account_id', conn.cme_account_id)
        .maybeSingle(),
      svc
        .from('algo_cme_accounts')
        .select('max_daily_loss, label')
        .eq('id', conn.cme_account_id)
        .maybeSingle(),
    ]);

    const risk = riskRes.data;
    const account = accountRes.data;

    if (!risk || !account || !risk.enabled) continue;

    const dailyPnl = Number(conn.daily_pnl_usd ?? 0);
    const maxLoss = Number(account.max_daily_loss ?? 0);
    if (!maxLoss) continue;

    const cbThreshold = maxLoss * (Number(risk.circuit_breaker_pct ?? 80) / 100);
    const isViolation = dailyPnl <= -maxLoss;
    const isCbTriggered = dailyPnl <= -cbThreshold;

    if (isCbTriggered) {
      await svc
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
