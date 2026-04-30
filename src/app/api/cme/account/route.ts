import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { getCashBalance, tradovateRenew } from '@/lib/cme/tradovate';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get('cmeAccountId');
  if (!cmeAccountId) return NextResponse.json({ error: 'cmeAccountId required' }, { status: 400 });

  const svc = createServiceClient();
  const { data: conn } = await svc
    .from('cme_connections')
    .select('id, tradovate_account_id, token_expires_at, status')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .maybeSingle();

  if (!conn || conn.status !== 'connected') {
    return NextResponse.json({ error: 'Not connected' }, { status: 422 });
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

  let balance: Awaited<ReturnType<typeof getCashBalance>>;
  try {
    balance = await getCashBalance(token, conn.tradovate_account_id, isPaper);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: snapshot } = await supabase
    .from('cme_equity_snapshots')
    .select('equity_usd, daily_pnl_usd, snapshot_at')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    {
      equity: balance.netLiq,
      balance: balance.cashBalance,
      unrealizedPnl: balance.unrealizedPnL,
      realizedPnl: balance.realizedPnL,
      dailyPnl: snapshot?.daily_pnl_usd ?? balance.realizedPnL,
    },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
