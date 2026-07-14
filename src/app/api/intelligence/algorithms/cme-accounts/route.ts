import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  const pg = getPgClient();
  let query = pg
    .from('algo_cme_accounts')
    .select('id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss, max_trailing_dd')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (type === 'propfirm' || type === 'broker') {
    query = query.eq('account_type', type);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
