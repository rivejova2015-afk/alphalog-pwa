import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompareTokens } from '@/lib/security/timing';
import { readCmeAccessToken, storeCmeAccessToken } from '@/lib/cme/vault';
import { tradovateRenew } from '@/lib/cme/tradovate';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: connections } = await svc
    .from('cme_connections')
    .select('id, user_id, cme_account_id, token_expires_at')
    .eq('status', 'connected')
    .eq('broker_type', 'tradovate');

  if (!connections?.length) return NextResponse.json({ renewed: 0 });

  let renewed = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    try {
      const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
      if (!expiresAt || expiresAt > new Date(Date.now() + 15 * 60 * 1000)) continue;

      const { data: acct } = await svc
        .from('algo_cme_accounts')
        .select('is_paper')
        .eq('id', conn.cme_account_id)
        .maybeSingle();

      const isPaper = acct?.is_paper ?? true;
      const token = await readCmeAccessToken(conn.id);
      if (!token) {
        await svc
          .from('cme_connections')
          .update({ status: 'error', last_error: 'token_missing', error_at: new Date().toISOString() })
          .eq('id', conn.id);
        continue;
      }

      const result = await tradovateRenew(token, isPaper);
      await storeCmeAccessToken(conn.id, result.accessToken);
      await svc
        .from('cme_connections')
        .update({ token_expires_at: result.expirationTime, updated_at: new Date().toISOString() })
        .eq('id', conn.id);

      renewed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      await svc
        .from('cme_connections')
        .update({ status: 'error', last_error: msg, error_at: new Date().toISOString() })
        .eq('id', conn.id);
    }
  }

  return NextResponse.json({ renewed, errors });
}

// Vercel Cron puede invocar GET o POST según config — alias para soportar ambos.
export const GET = POST;
