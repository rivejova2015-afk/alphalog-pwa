import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { getPgClient } from '@/lib/pg/client';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  if (!agent) return NextResponse.json({ error: 'No coinarb agent' }, { status: 404 });

  // coinarb_telemetry is in-scope (own Postgres); the shim has no `.limit()`
  // / `.maybeSingle()`, but `.single()` already returns the first row (or
  // null on zero rows) of the ordered result set, matching `.limit(1)` +
  // `.maybeSingle()` semantics.
  const pg = getPgClient();
  const { data, error } = await pg
    .from('coinarb_telemetry')
    .select('*')
    .eq('agent_id', agent.id)
    .order('last_heartbeat_at', { ascending: false })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { agent, telemetry: data ?? null },
    { headers: { 'Cache-Control': 'private, max-age=5' } },
  );
}
