import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('polyarb_telemetry')
    .select('*')
    .eq('user_id', user.id)
    .order('last_heartbeat_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'No telemetry data' }, { status: 404 });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=5' },
  });
}
