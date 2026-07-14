import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';

type ConnectionRow = {
  id: string;
  status: string;
  broker_type: string;
  tradovate_account_id: string | null;
  tradovate_account_spec: string | null;
  token_expires_at: string | null;
  daily_pnl_usd: number | null;
  last_error: string | null;
  last_connected_at: string | null;
  updated_at: string;
  cme_account_id: string;
};

type AccountRow = {
  id: string;
  label: string | null;
  provider_name: string;
  account_number: string;
  account_type: string;
  is_paper: boolean;
  funded_amount: number | null;
  max_daily_loss: number | null;
};

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pg = getPgClient();

  // La query original de Supabase usaba un embed (`algo_cme_accounts (...)`)
  // sobre la FK cme_connections.cme_account_id -> algo_cme_accounts.id. El
  // shim de Postgres crudo no soporta joins/embeds, así que esto se separa
  // en dos queries secuenciales, ambas explícitamente filtradas por
  // user_id — igual que la query original (que además dependía de RLS en
  // ambas tablas para el mismo scoping).
  const { data: connsRaw, error: connsErr } = await pg
    .from('cme_connections')
    .select(
      'id, status, broker_type, tradovate_account_id, tradovate_account_spec, token_expires_at, daily_pnl_usd, last_error, last_connected_at, updated_at, cme_account_id'
    )
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (connsErr) return NextResponse.json({ error: connsErr.message }, { status: 500 });

  const conns = (connsRaw ?? []) as unknown as ConnectionRow[];

  const { data: acctsRaw, error: acctsErr } = await pg
    .from('algo_cme_accounts')
    .select('id, label, provider_name, account_number, account_type, is_paper, funded_amount, max_daily_loss')
    .eq('user_id', user.id);

  if (acctsErr) return NextResponse.json({ error: acctsErr.message }, { status: 500 });

  const acctsById = new Map(
    ((acctsRaw ?? []) as unknown as AccountRow[]).map((a) => [a.id, a])
  );

  const data = conns.map((c) => ({
    ...c,
    algo_cme_accounts: acctsById.get(c.cme_account_id) ?? null,
  }));

  return NextResponse.json(
    { data },
    { headers: { 'Cache-Control': 'private, max-age=10' } }
  );
}
