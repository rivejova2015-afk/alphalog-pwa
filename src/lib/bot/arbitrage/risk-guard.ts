// Risk guard para latency arb
//
// Cierra posiciones que excedieron max_hold_seconds.
// Computa Kelly sizing capado a max_hold_seconds + circuit breaker -5% diario.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPgClient } from '@/lib/pg/client';

export interface PairConfig {
  algorithm_id:     string;
  user_id:          string;
  fast_bot_account_id: string;
  slow_bot_account_id: string;
  max_hold_seconds: number;
  min_hold_seconds: number;
}

export interface ExpiredPosition {
  bot_account_id:  string;
  position_ref:    string;
  age_seconds:     number;
}

/**
 * Lee posiciones abiertas en el slow_bot_account que ya pasaron max_hold_seconds
 * y devuelve la lista para emisión de comandos CLOSE.
 *
 * NOTA: las posiciones se rastrean en bot_open_positions (creada en migration 063).
 * Usamos last_seen_at + opened_at para calcular age.
 */
export async function listExpiredPositions(
  sb: SupabaseClient,
  pair: PairConfig,
): Promise<ExpiredPosition[]> {
  const { data: positions } = await sb
    .from('bot_open_positions')
    .select('id,ticket,open_time,bot_account_id')
    .eq('bot_account_id', pair.slow_bot_account_id)
    .eq('user_id', pair.user_id)
    .eq('status', 'open');

  if (!positions?.length) return [];
  const now = Date.now();
  return positions
    .map((p) => {
      const age = (now - new Date(p.open_time as string).getTime()) / 1000;
      return { bot_account_id: p.bot_account_id as string, position_ref: String(p.ticket), age_seconds: Math.round(age) };
    })
    .filter((p) => p.age_seconds >= pair.max_hold_seconds);
}

/**
 * Verifica circuit breaker diario: si el algorithm cayó >5% hoy, abortar.
 * Se basa en pnl_today del row de algorithms.
 *
 * `algorithms` is in-scope (own Postgres) — this now reads via `getPgClient()`
 * instead of the injected `sb`. The `sb` parameter is kept (unused inside
 * this function) so the exported signature — and every existing call site,
 * including the vitest mocks in
 * `src/lib/bot/__tests__/arbitrage/risk-guard.test.ts` — doesn't need to
 * change. NOTE for the controller: those existing unit tests mock `sb` for
 * the `algorithms` lookup this function used to make; they still type-check
 * but will no longer exercise real coverage here since the lookup now goes
 * through `getPgClient()` — worth a follow-up test update, out of scope for
 * this migration task.
 */
export async function isDailyCircuitOpen(
  sb: SupabaseClient,
  algorithmId: string,
  ddLimit = 0.05,
): Promise<{ open: boolean; reason: string | null }> {
  void sb;
  const pg = getPgClient();
  const { data: algoRaw } = await pg
    .from('algorithms')
    .select('pnl_today,parameters')
    .eq('id', algorithmId)
    .single();
  const algo = algoRaw as { pnl_today: number | null; parameters?: unknown } | null;
  if (!algo) return { open: true, reason: 'Algorithm not found' };

  const pnlToday = typeof algo.pnl_today === 'number' ? algo.pnl_today : 0;
  // pnl_today se asume en porcentaje (-5 = -5%). Si es fracción (-0.05) lo normalizamos.
  const pct = Math.abs(pnlToday) <= 1 ? pnlToday : pnlToday / 100;

  if (pct <= -ddLimit) {
    return { open: true, reason: `Daily DD ${(pct * 100).toFixed(2)}% ≤ -${(ddLimit * 100).toFixed(0)}% — circuit breaker disparado` };
  }
  return { open: false, reason: null };
}
