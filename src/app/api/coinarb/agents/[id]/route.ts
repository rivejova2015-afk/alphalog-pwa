import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('coinarb_agents')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { api_key_encrypted, api_secret_encrypted, api_passphrase_encrypted, ...safe } = data as Record<string, unknown>;
  return NextResponse.json({
    ...safe,
    has_cdp_key: !!api_key_encrypted,
    has_cdp_secret: !!api_secret_encrypted,
    has_intx_passphrase: !!api_passphrase_encrypted,
  }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.slice(0, 100);
  if (typeof body.starting_capital_usd === 'number') updates.starting_capital_usd = body.starting_capital_usd;
  if (typeof body.config === 'object' && body.config !== null) {
    updates.config = body.config as Record<string, unknown>;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('coinarb_agents')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .select('id, name, config, starting_capital_usd, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
