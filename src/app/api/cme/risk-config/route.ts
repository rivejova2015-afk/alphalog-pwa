import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSchema = z.object({
  cmeAccountId: z.string().uuid(),
  circuit_breaker_pct: z.number().min(1).max(100).optional(),
  max_positions: z.number().int().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  paused_reason: z.enum(['circuit_breaker', 'manual', 'violation']).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get('cmeAccountId');

  let query = supabase
    .from('cme_risk_configs')
    .select('*')
    .eq('user_id', user.id);

  if (cmeAccountId) query = query.eq('cme_account_id', cmeAccountId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { cmeAccountId, ...updates } = parsed.data;

  const { data, error } = await supabase
    .from('cme_risk_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('cme_account_id', cmeAccountId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
