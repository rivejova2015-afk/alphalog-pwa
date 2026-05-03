import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ error: 'No coinarb agent' }, { status: 404 });

  const { data, error } = await supabase
    .from('coinarb_telemetry')
    .select('*')
    .eq('agent_id', agent.id)
    .order('last_heartbeat_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { agent, telemetry: data ?? null },
    { headers: { 'Cache-Control': 'private, max-age=5' } },
  );
}
