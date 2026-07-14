import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get('cmeAccountId');

  const pg = getPgClient();
  let query = pg
    .from('cme_positions')
    .select('*')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false });

  if (cmeAccountId) query = query.eq('cme_account_id', cmeAccountId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=10' } }
  );
}
