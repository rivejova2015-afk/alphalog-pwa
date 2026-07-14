import { NextRequest, NextResponse } from 'next/server';
import { getPgClient } from '@/lib/pg/client';
import { safeCompareTokens } from '@/lib/security/timing';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { getPositions, tradovateRenew } from '@/lib/cme/tradovate';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pg = getPgClient();

  // Ajuste #5: barrido de señales pending vencidas (expires_at < now()) antes
  // de sincronizar posiciones — este cron ya corre cada minuto, es el hogar
  // natural para esto en vez de crear un cron nuevo dedicado.
  await pg
    .from('cme_signals')
    .update({ status: 'rejected', reject_reason: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString());

  type ConnectionRow = { id: string; user_id: string; cme_account_id: string; tradovate_account_id: number; tradovate_account_spec: string; token_expires_at: string | null };

  const { data: connectionsRaw } = await pg
    .from('cme_connections')
    .select('id, user_id, cme_account_id, tradovate_account_id, tradovate_account_spec, token_expires_at')
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

      const positions = await getPositions(token, conn.tradovate_account_id, isPaper);

      await pg
        .from('cme_positions')
        .delete()
        .eq('user_id', conn.user_id)
        .eq('cme_account_id', conn.cme_account_id)
        .eq('is_manual', false);

      if (positions.length > 0) {
        await pg.from('cme_positions').insert(
          positions.map(p => ({
            user_id: conn.user_id,
            cme_account_id: conn.cme_account_id,
            connection_id: conn.id,
            contract: String(p.contractId),
            direction: p.netPos > 0 ? 'LONG' : 'SHORT',
            quantity: Math.abs(p.netPos),
            avg_entry_price: p.netPrice || null,
            broker_position_id: String(p.id),
            opened_at: p.timestamp,
            updated_at: new Date().toISOString(),
          }))
        );
      }

      synced++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      await pg
        .from('cme_connections')
        .update({ last_error: errors[errors.length - 1], error_at: new Date().toISOString() })
        .eq('id', conn.id);
    }
  }

  return NextResponse.json({ synced, errors });
}
