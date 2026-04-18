import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('polyarb_agents')
    .select('id, name, status, starting_capital_usd, last_heartbeat_at, config, created_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only one agent per user allowed
  const { data: existing } = await supabase
    .from('polyarb_agents')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (existing) return NextResponse.json({ error: 'Agent already exists' }, { status: 409 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const { data, error } = await supabase
    .from('polyarb_agents')
    .insert({
      user_id: user.id,
      name: (body.name as string) || 'PolyArb Alpha v1',
      status: 'STOPPED',
      starting_capital_usd: (body.starting_capital_usd as number) || 50,
    })
    .select('id, name, status, starting_capital_usd, last_heartbeat_at, config, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
