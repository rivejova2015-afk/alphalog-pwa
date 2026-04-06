import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('polyarb_agents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Strip encrypted fields from response
  const { api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted, ...safe } = data;
  return NextResponse.json({
    ...safe,
    has_api_key: !!api_key_encrypted,
    has_api_secret: !!api_secret_encrypted,
    has_api_passphrase: !!api_passphrase_encrypted,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;

  // Only allow updating name, config, and starting_capital_usd
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.slice(0, 100);
  if (typeof body.config === 'object' && body.config !== null) updates.config = body.config;
  if (typeof body.starting_capital_usd === 'number') updates.starting_capital_usd = body.starting_capital_usd;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('polyarb_agents')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id, name, config, starting_capital_usd')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
