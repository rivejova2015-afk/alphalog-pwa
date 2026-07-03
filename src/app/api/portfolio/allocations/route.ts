import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Lee la asignación HRP vigente (is_current=true) del usuario, con nombre y
// market_type de cada algoritmo para mostrar en el panel. La corrida real
// la hace el cron semanal /api/cron/portfolio/rebalance — este endpoint es
// solo lectura para la UI.
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: allocations, error } = await supabase
    .from('portfolio_allocations')
    .select('id, algorithm_id, weight, daily_return_stdev, run_at, lookback_days')
    .eq('user_id', userData.user.id)
    .eq('is_current', true)
    .order('weight', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!allocations || allocations.length === 0) {
    return NextResponse.json({ allocations: [], runAt: null, lookbackDays: null });
  }

  const algorithmIds = allocations.map((a) => a.algorithm_id);
  const { data: algos } = await supabase
    .from('algorithms')
    .select('id, name, market_type')
    .in('id', algorithmIds);

  const algoById = new Map((algos ?? []).map((a) => [a.id, a]));

  const rows = allocations.map((a) => ({
    algorithmId: a.algorithm_id,
    algorithmName: algoById.get(a.algorithm_id)?.name ?? 'Desconocido',
    marketType: algoById.get(a.algorithm_id)?.market_type ?? null,
    weight: Number(a.weight),
    dailyReturnStdev: a.daily_return_stdev != null ? Number(a.daily_return_stdev) : null,
  }));

  return NextResponse.json(
    {
      allocations: rows,
      runAt: allocations[0].run_at,
      lookbackDays: allocations[0].lookback_days,
    },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
  );
}
