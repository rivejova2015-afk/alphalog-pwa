import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPgClient } from '@/lib/pg/client';

type RealTradeRow = {
  id: string;
  contract: string;
  direction: string;
  quantity: number;
  fill_price: number | null;
  status: string;
  pnl_usd: number | null;
  commission_usd: number | null;
  slippage_ticks: number | null;
  close_reason: string | null;
  fill_timestamp: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cmeAccountId = searchParams.get('cmeAccountId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const format = searchParams.get('format');

  const pg = getPgClient();
  let query = pg
    .from('cme_trades_real')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cmeAccountId) query = query.eq('cme_account_id', cmeAccountId);

  const { data: pageRows, error, count: total } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const data = (pageRows ?? []) as unknown as RealTradeRow[];
  const count = total ?? 0;

  if (format === 'csv') {
    const header = 'id,contract,direction,quantity,fill_price,status,pnl_usd,commission_usd,slippage_ticks,close_reason,fill_timestamp\n';
    const rows = (data ?? []).map(t =>
      [t.id, t.contract, t.direction, t.quantity, t.fill_price, t.status,
       t.pnl_usd, t.commission_usd, t.slippage_ticks, t.close_reason, t.fill_timestamp
      ].join(',')
    ).join('\n');
    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="cme-trades-real.csv"',
      },
    });
  }

  return NextResponse.json(
    { data, count },
    { headers: { 'Cache-Control': 'private, max-age=30' } }
  );
}
