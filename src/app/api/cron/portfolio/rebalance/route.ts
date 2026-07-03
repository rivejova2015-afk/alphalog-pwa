import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { safeCompareTokens } from '@/lib/security/timing';
import { logError, logInfo } from '@/lib/log';
import { hrpAllocate } from '@/lib/portfolio/hrp';
import { stdVector } from '@/lib/portfolio/correlation';
import {
  loadAlgorithmReturns,
  buildCalendar,
  alignReturnsToCalendar,
  countActiveDays,
} from '@/lib/portfolio/returns';

// Recalcula la asignación de capital vía Hierarchical Risk Parity entre los
// algoritmos activos (paper/live) del usuario, usando sus retornos diarios
// reales de los últimos LOOKBACK_DAYS. Corre semanal (crontab, domingo) —
// el capital no necesita reasignarse más seguido que eso.
//
// Algoritmos con poca actividad real (< MIN_ACTIVE_DAYS con retorno != 0)
// se excluyen de la corrida — HRP con una serie casi toda en cero produce
// correlaciones degeneradas. Si quedan menos de 2 algos calificados, la
// corrida se aborta sin tocar la asignación vigente (no hay nada que
// diversificar con 0 o 1 algo).
const LOOKBACK_DAYS = 60;
const MIN_ACTIVE_DAYS = 10;

interface AlgoRow {
  id: string;
  user_id: string;
  name: string | null;
  market_type: string | null;
  parameters: Record<string, unknown> | null;
  status: string | null;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? '';
  if (!safeCompareTokens(secret, process.env.CRON_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: algorithms, error: fetchErr } = await svc
    .from('algorithms')
    .select('id, user_id, name, market_type, parameters, status')
    .in('status', ['paper', 'live'])
    .is('deleted_at', null);

  if (fetchErr) {
    logError('Portfolio', { component: 'rebalance fetch algorithms', message: fetchErr.message });
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const byUser = new Map<string, AlgoRow[]>();
  for (const algo of (algorithms ?? []) as AlgoRow[]) {
    const list = byUser.get(algo.user_id) ?? [];
    list.push(algo);
    byUser.set(algo.user_id, list);
  }

  const results: Array<{ userId: string; ran: boolean; reason?: string; algorithmCount?: number }> = [];

  for (const [userId, algos] of byUser) {
    try {
      const perAlgoReturns = await Promise.all(
        algos.map((a) => loadAlgorithmReturns(svc, a, LOOKBACK_DAYS)),
      );

      const qualifying = algos
        .map((a, i) => ({ algo: a, returns: perAlgoReturns[i] }))
        .filter((x) => countActiveDays(x.returns) >= MIN_ACTIVE_DAYS);

      if (qualifying.length < 2) {
        results.push({ userId, ran: false, reason: 'not_enough_algorithms', algorithmCount: qualifying.length });
        continue;
      }

      const calendar = buildCalendar(LOOKBACK_DAYS);
      const series = qualifying.map((x) => alignReturnsToCalendar(x.returns, calendar));
      const labels = qualifying.map((x) => x.algo.id);
      const allocation = hrpAllocate({ series, labels });
      const stdevs = stdVector(series);

      // Vieja corrida deja de ser vigente antes de insertar la nueva.
      await svc
        .from('portfolio_allocations')
        .update({ is_current: false })
        .eq('user_id', userId)
        .eq('is_current', true);

      const rows = allocation.map((a, i) => ({
        user_id: userId,
        lookback_days: LOOKBACK_DAYS,
        algorithm_id: a.label,
        weight: a.weight,
        daily_return_stdev: stdevs[i],
        is_current: true,
      }));

      const { error: insErr } = await svc.from('portfolio_allocations').insert(rows);
      if (insErr) {
        logError('Portfolio', { component: 'rebalance insert', message: insErr.message, meta: { userId } });
        results.push({ userId, ran: false, reason: insErr.message });
        continue;
      }

      logInfo('Portfolio', `rebalance: ${qualifying.length} algos, weights=${allocation.map((a) => `${a.label.slice(0, 8)}:${(a.weight * 100).toFixed(1)}%`).join(',')} (user=${userId})`);
      results.push({ userId, ran: true, algorithmCount: qualifying.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('Portfolio', { component: 'rebalance threw', message: msg, meta: { userId } });
      results.push({ userId, ran: false, reason: msg });
    }
  }

  return NextResponse.json({ users: results.length, results });
}

// Vercel Cron puede invocar GET o POST según config — alias para soportar ambos.
export const GET = POST;
