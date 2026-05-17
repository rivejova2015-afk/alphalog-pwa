import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCoinarbAgent } from '@/lib/coinarb/agent';
import { logAuditFromRequest } from '@/lib/security/auditLog';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getCoinarbAgent(supabase, user.id);
  return NextResponse.json(agent ? [agent] : [], {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await getCoinarbAgent(supabase, user.id);
  if (existing) return NextResponse.json({ error: 'Coinarb agent already exists' }, { status: 409 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const { data, error } = await supabase
    .from('coinarb_agents')
    .insert({
      user_id: user.id,
      name: (body.name as string) || 'Coinarb 50x',
      status: 'STOPPED',
      starting_capital_usd: typeof body.starting_capital_usd === 'number' ? body.starting_capital_usd : 100,
      config: {
        kind: 'coinarb',
        venue: 'coinbase',
        paper_mode: true,
        ...(typeof body.config === 'object' && body.config !== null ? body.config : {}),
      },
    })
    .select('id, name, status, starting_capital_usd, last_heartbeat_at, config, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAuditFromRequest(
    { userId: user.id, action: "create", resourceType: "agent", resourceId: data.id, status: "success" },
    request
  );

  return NextResponse.json(data, { status: 201 });
}
