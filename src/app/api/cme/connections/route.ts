import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('cme_connections')
    .select(`
      id, status, broker_type, tradovate_account_id, tradovate_account_spec,
      token_expires_at, daily_pnl_usd, last_error, last_connected_at, updated_at,
      cme_account_id,
      algo_cme_accounts (
        id, label, provider_name, account_number, account_type, is_paper,
        funded_amount, max_daily_loss
      )
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=10' } }
  );
}
