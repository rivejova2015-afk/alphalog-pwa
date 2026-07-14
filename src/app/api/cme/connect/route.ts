import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';
import { requireOwnership } from '@/lib/ownership';
import { tradovateAuth, getAccounts } from '@/lib/cme/tradovate';
import { storeCmeAccessToken } from '@/lib/cme/vault';
import { logAuditFromRequest } from '@/lib/security/auditLog';
import { z } from 'zod';

const schema = z.object({
  cmeAccountId: z.string().uuid(),
  tradovateUsername: z.string().min(1),
  tradovatePassword: z.string().min(1),
  appId: z.string().default('AlphaLog'),
  appVersion: z.string().default('1.0.0'),
  cid: z.number().int().default(0),
  sec: z.string().default(''),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { cmeAccountId, tradovateUsername, tradovatePassword, appId, appVersion, cid, sec } = parsed.data;

  const pg = getPgClient();
  const { data: acctRaw } = await pg
    .from('algo_cme_accounts')
    .select('id, user_id, is_paper, provider_name, account_number')
    .eq('id', cmeAccountId)
    .maybeSingle();
  const acct = requireOwnership(
    acctRaw as { id: string; user_id: string; is_paper: boolean; provider_name: string; account_number: string } | null,
    user.id
  );

  if (!acct) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  let authResult: Awaited<ReturnType<typeof tradovateAuth>>;
  try {
    authResult = await tradovateAuth(
      { name: tradovateUsername, password: tradovatePassword, appId, appVersion, cid, sec },
      acct.is_paper ?? false
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Tradovate auth failed: ${msg}` }, { status: 502 });
  }

  let accounts: Awaited<ReturnType<typeof getAccounts>>;
  try {
    accounts = await getAccounts(authResult.accessToken, acct.is_paper ?? false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not fetch Tradovate accounts: ${msg}` }, { status: 502 });
  }

  const matched = accounts.find(
    a => String(a.id) === String(acct.account_number) || a.name === acct.account_number
  ) ?? accounts[0];

  if (!matched) {
    return NextResponse.json({ error: 'No Tradovate account found for this user' }, { status: 422 });
  }

  const { data: connRaw } = await pg
    .from('cme_connections')
    .upsert(
      {
        user_id: user.id,
        cme_account_id: cmeAccountId,
        status: 'connected',
        broker_type: 'tradovate',
        tradovate_account_id: matched.id,
        tradovate_account_spec: matched.name,
        token_expires_at: authResult.expirationTime,
        last_connected_at: new Date().toISOString(),
        last_error: null,
        error_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cme_account_id' }
    )
    .single();

  if (!connRaw) {
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
  const conn = connRaw as unknown as { id: string };

  await storeCmeAccessToken(conn.id, authResult.accessToken);

  await pg
    .from('cme_risk_configs')
    .upsert(
      {
        user_id: user.id,
        cme_account_id: cmeAccountId,
        circuit_breaker_pct: 80,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,cme_account_id' }
    );

  await logAuditFromRequest(
    { userId: user.id, action: 'api_call', resourceType: 'account', status: 'success', changes: { cme_account_id: cmeAccountId, tradovate_account_id: matched.id } },
    req
  );

  return NextResponse.json({
    success: true,
    connectionId: conn.id,
    tradovateAccountId: matched.id,
    tradovateAccountName: matched.name,
  });
}
