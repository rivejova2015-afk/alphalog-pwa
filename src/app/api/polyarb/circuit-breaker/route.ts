import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '20'));

  const { data, error } = await supabase
    .from('polyarb_circuit_breaker_events')
    .select('id, trigger_type, severity, detail, action_taken, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' },
  });
}
