import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(90, parseInt(request.nextUrl.searchParams.get('days') ?? '7'));
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('polyarb_equity_snapshots')
    .select('equity_usd, pnl_usd, open_positions, btc_price, snapshot_at')
    .eq('user_id', user.id)
    .gte('snapshot_at', cutoff)
    .order('snapshot_at', { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
