import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';
import { z } from 'zod';

const createSchema = z.object({
  account_type: z.enum(['propfirm', 'broker']),
  provider_name: z.string().min(1),
  account_number: z.string().min(1),
  label: z.string().trim().optional().nullable(),
  funded_amount: z.number().nonnegative().optional().nullable(),
  max_daily_loss: z.number().nonnegative().optional().nullable(),
  max_trailing_dd: z.number().nonnegative().optional().nullable(),
  is_paper: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pg = getPgClient();
  const { data, error } = await pg
    .from('algo_cme_accounts')
    .insert({
      user_id: user.id,
      account_type: parsed.data.account_type,
      provider_name: parsed.data.provider_name,
      account_number: parsed.data.account_number,
      label: parsed.data.label ?? null,
      funded_amount: parsed.data.funded_amount ?? null,
      max_daily_loss: parsed.data.max_daily_loss ?? null,
      max_trailing_dd: parsed.data.max_trailing_dd ?? null,
      is_paper: parsed.data.is_paper,
    })
    .select('id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss, max_trailing_dd')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  const pg = getPgClient();
  let query = pg
    .from('algo_cme_accounts')
    .select('id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss, max_trailing_dd')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (type === 'propfirm' || type === 'broker') {
    query = query.eq('account_type', type);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
