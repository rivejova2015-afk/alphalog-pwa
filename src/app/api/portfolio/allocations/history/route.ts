import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Historial de corridas HRP pasadas — /api/portfolio/allocations solo expone
// la corrida vigente (is_current=true); este endpoint trae las últimas N
// corridas completas (vigente + históricas) para que la UI pueda mostrar
// cómo evolucionaron los pesos entre rebalanceos semanales.
const MAX_RUNS = 10;

export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: allocations, error } = await supabase
    .from('portfolio_allocations')
    .select('algorithm_id, weight, run_at, lookback_days')
    .eq('user_id', userData.user.id)
    .order('run_at', { ascending: false })
    .limit(MAX_RUNS * 20); // margen generoso — se recorta a MAX_RUNS corridas distintas abajo

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = allocations ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ runs: [] });
  }

  const algorithmIds = Array.from(new Set(rows.map((r) => r.algorithm_id)));
  const { data: algos } = await supabase
    .from('algorithms')
    .select('id, name')
    .in('id', algorithmIds);
  const nameById = new Map((algos ?? []).map((a) => [a.id, a.name as string]));

  // Agrupar por run_at (todas las filas con el mismo timestamp = misma corrida).
  const byRunAt = new Map<string, { algorithmId: string; algorithmName: string; weight: number }[]>();
  const lookbackByRunAt = new Map<string, number>();
  for (const row of rows) {
    const key = row.run_at as string;
    const list = byRunAt.get(key) ?? [];
    list.push({
      algorithmId: row.algorithm_id as string,
      algorithmName: nameById.get(row.algorithm_id as string) ?? 'Desconocido',
      weight: Number(row.weight),
    });
    byRunAt.set(key, list);
    lookbackByRunAt.set(key, row.lookback_days as number);
  }

  const runs = Array.from(byRunAt.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1)) // más reciente primero
    .slice(0, MAX_RUNS)
    .map(([runAt, allocationsForRun]) => ({
      runAt,
      lookbackDays: lookbackByRunAt.get(runAt) ?? null,
      allocations: allocationsForRun.sort((a, b) => b.weight - a.weight),
    }));

  return NextResponse.json(
    { runs },
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } },
  );
}
