import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';
import { requireOwnership } from '@/lib/ownership';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { closePosition, tradovateRenew } from '@/lib/cme/tradovate';
import { logAuditFromRequest } from '@/lib/security/auditLog';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const pg = getPgClient();

  const { data: posRaw } = await pg
    .from('cme_positions')
    .select('id, user_id, cme_account_id, connection_id, contract, quantity, broker_position_id')
    .eq('id', id)
    .maybeSingle();
  const pos = requireOwnership(
    posRaw as {
      id: string;
      user_id: string;
      cme_account_id: string;
      connection_id: string;
      contract: string;
      quantity: number;
      broker_position_id: string;
    } | null,
    user.id
  );

  if (!pos) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

  const { data: connRaw } = await pg
    .from('cme_connections')
    .select('id, tradovate_account_id, tradovate_account_spec, token_expires_at')
    .eq('id', pos.connection_id)
    .maybeSingle();
  const conn = connRaw as {
    id: string;
    tradovate_account_id: number;
    tradovate_account_spec: string;
    token_expires_at: string | null;
  } | null;

  if (!conn) return NextResponse.json({ error: 'No connection for position' }, { status: 404 });

  const { data: acctRaw } = await pg
    .from('algo_cme_accounts')
    .select('is_paper')
    .eq('id', pos.cme_account_id)
    .maybeSingle();

  const isPaper = (acctRaw as { is_paper: boolean } | null)?.is_paper ?? true;

  let token = await readCmeAccessToken(conn.id);
  if (!token) return NextResponse.json({ error: 'No vault token' }, { status: 503 });

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  if (expiresAt && expiresAt < new Date(Date.now() + 10 * 60 * 1000)) {
    try {
      const renewed = await tradovateRenew(token, isPaper);
      token = renewed.accessToken;
      await storeCmeAccessToken(conn.id, token);
      await pg
        .from('cme_connections')
        .update({ token_expires_at: renewed.expirationTime })
        .eq('id', conn.id);
    } catch { /* use existing token */ }
  }

  try {
    await closePosition({
      token,
      isPaper,
      accountSpec: conn.tradovate_account_spec,
      accountId: conn.tradovate_account_id,
      positionId: Number(pos.broker_position_id),
      symbol: pos.contract,
      qty: pos.quantity,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await pg.from('cme_positions').delete().eq('id', pos.id);
  await logAuditFromRequest(
    { userId: user.id, action: 'delete', resourceType: 'trade', resourceId: id, status: 'success' },
    req
  );

  return NextResponse.json({ success: true });
}
