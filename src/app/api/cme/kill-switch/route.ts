import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { closePosition, tradovateRenew } from '@/lib/cme/tradovate';
import { logAuditFromRequest } from '@/lib/security/auditLog';
import { z } from 'zod';

const schema = z.object({ cmeAccountId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cmeAccountId } = parsed.data;
  const svc = createServiceClient();

  const { data: conn } = await svc
    .from('cme_connections')
    .select('id, tradovate_account_id, tradovate_account_spec, token_expires_at, status')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .maybeSingle();

  if (!conn || conn.status !== 'connected') {
    return NextResponse.json({ error: 'Account not connected' }, { status: 422 });
  }

  const { data: acct } = await svc
    .from('algo_cme_accounts')
    .select('is_paper')
    .eq('id', cmeAccountId)
    .maybeSingle();

  const isPaper = acct?.is_paper ?? true;

  let token = await readCmeAccessToken(conn.id);
  if (!token) return NextResponse.json({ error: 'No vault token' }, { status: 503 });

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  if (expiresAt && expiresAt < new Date(Date.now() + 10 * 60 * 1000)) {
    try {
      const renewed = await tradovateRenew(token, isPaper);
      token = renewed.accessToken;
      await storeCmeAccessToken(conn.id, token);
      await svc.from('cme_connections').update({ token_expires_at: renewed.expirationTime }).eq('id', conn.id);
    } catch { /* use existing */ }
  }

  const { data: positions } = await supabase
    .from('cme_positions')
    .select('id, contract, quantity, broker_position_id')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId);

  let closedCount = 0;
  const errors: string[] = [];

  for (const pos of positions ?? []) {
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
      await supabase.from('cme_positions').delete().eq('id', pos.id);
      closedCount++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  await svc
    .from('cme_risk_configs')
    .update({
      enabled: false,
      paused_reason: 'manual',
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId);

  await logAuditFromRequest(
    { userId: user.id, action: 'delete', resourceType: 'account', status: 'success', changes: { cme_account_id: cmeAccountId, closed_count: closedCount } },
    req
  );

  return NextResponse.json({ success: true, closedCount, errors });
}
