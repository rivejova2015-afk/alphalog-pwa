import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { safeCompareTokens } from '@/lib/security/timing';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { getCashBalance, tradovateRenew } from '@/lib/cme/tradovate';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pg = getPgClient();

  type ConnectionRow = { id: string; user_id: string; cme_account_id: string; tradovate_account_id: number; token_expires_at: string | null };

  const { data: connectionsRaw } = await pg
    .from('cme_connections')
    .select('id, user_id, cme_account_id, tradovate_account_id, token_expires_at')
    .eq('status', 'connected')
    .eq('broker_type', 'tradovate');

  const connections = (connectionsRaw ?? []) as unknown as ConnectionRow[];
  if (!connections.length) return NextResponse.json({ synced: 0 });

  let synced = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    try {
      const { data: acct } = await pg
        .from('algo_cme_accounts')
        .select('is_paper')
        .eq('id', conn.cme_account_id)
        .maybeSingle();

      const isPaper = (acct as { is_paper: boolean } | null)?.is_paper ?? true;

      let token = await readCmeAccessToken(conn.id);
      if (!token) continue;

      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
      if (expiresAt && expiresAt < new Date(Date.now() + 10 * 60 * 1000)) {
        const renewed = await tradovateRenew(token, isPaper);
        token = renewed.accessToken;
        await storeCmeAccessToken(conn.id, token);
        await pg
          .from('cme_connections')
          .update({ token_expires_at: renewed.expirationTime })
          .eq('id', conn.id);
      }

      const cash = await getCashBalance(token, conn.tradovate_account_id, isPaper);

      await pg.from('cme_equity_snapshots').insert({
        user_id: conn.user_id,
        cme_account_id: conn.cme_account_id,
        equity_usd: cash.netLiq,
        balance_usd: cash.cashBalance,
        daily_pnl_usd: cash.realizedPnL,
        open_pnl_usd: cash.unrealizedPnL,
        snapshot_at: new Date().toISOString(),
      });

      await pg
        .from('cme_connections')
        .update({
          daily_pnl_usd: cash.realizedPnL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conn.id);

      synced++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.json({ synced, errors });
}
