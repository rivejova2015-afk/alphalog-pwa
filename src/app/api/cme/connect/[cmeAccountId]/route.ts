import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';
import { requireOwnership } from '@/lib/ownership';
import { deleteCmeAccessToken } from '@/lib/cme/vault';
import { logAuditFromRequest } from '@/lib/security/auditLog';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cmeAccountId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cmeAccountId } = await params;
  const pg = getPgClient();

  const { data: connRaw } = await pg
    .from('cme_connections')
    .select('id, user_id')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .maybeSingle();
  const conn = requireOwnership(connRaw as { id: string; user_id: string } | null, user.id);

  if (conn) {
    try {
      await deleteCmeAccessToken(conn.id);
    } catch (err) {
      console.warn('Failed to delete CME vault token for connection', conn.id, err);
    }
    await pg
      .from('cme_connections')
      .update({ status: 'disconnected', updated_at: new Date().toISOString() })
      .eq('id', conn.id);
  }

  await logAuditFromRequest(
    { userId: user.id, action: 'api_call', resourceType: 'account', status: 'success', changes: { cme_account_id: cmeAccountId } },
    req
  );

  return NextResponse.json({ success: true });
}
