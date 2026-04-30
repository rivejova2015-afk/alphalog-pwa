import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get('cmeAccountId');
  if (!cmeAccountId) return NextResponse.json({ error: 'cmeAccountId required' }, { status: 400 });

  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const { data, error } = await supabase
    .from('cme_equity_snapshots')
    .select('equity_usd, balance_usd, daily_pnl_usd, open_pnl_usd, snapshot_at')
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .order('snapshot_at', { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  );
}
