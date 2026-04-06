import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50'));
  const offset = parseInt(request.nextUrl.searchParams.get('offset') ?? '0');

  const { data, error, count } = await supabase
    .from('polyarb_trades')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('executed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
