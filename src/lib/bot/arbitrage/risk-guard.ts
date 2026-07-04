// Risk guard para latency arb
//
// Cierra posiciones que excedieron max_hold_seconds.
// Computa Kelly sizing capado a max_hold_seconds + circuit breaker -5% diario.

import type { SupabaseClient } from '@supabase/supabase-js';

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
 *
 * `algorithms.pnl_today` es siempre dólares (numeric(14,2), ver migration 044
 * y todos sus consumers: AlgoCard/AlgoAccordion lo formatean como `$X.XX`).
 * No hay ninguna ambigüedad fracción/porcentaje que "normalizar" — para
 * expresarlo como % de drawdown hace falta el equity de la cuenta que
 * sostiene las posiciones (`bot_telemetry.equity` del slow_bot_account, que
 * es la cuenta que efectivamente abre/cierra posiciones en el par de arb).
 * Sin ese equity no se puede calcular un % válido, así que no se dispara el
 * breaker (fail-open) en vez de adivinar una unidad — mejor que interpretar
 * cualquier pérdida en dólares como una caída de decenas de puntos porcentuales.
 */
export async function isDailyCircuitOpen(
  sb: SupabaseClient,
  algorithmId: string,
  botAccountId: string,
  ddLimit = 0.05,
): Promise<{ open: boolean; reason: string | null }> {
  const { data: algo } = await sb
    .from('algorithms')
    .select('pnl_today')
    .eq('id', algorithmId)
    .maybeSingle();
  if (!algo) return { open: true, reason: 'Algorithm not found' };

  const pnlToday = typeof algo.pnl_today === 'number' ? algo.pnl_today : 0;
  if (pnlToday >= 0) return { open: false, reason: null };

  const { data: telemetry } = await sb
    .from('bot_telemetry')
    .select('equity')
    .eq('bot_account_id', botAccountId)
    .maybeSingle();
  const equity = typeof telemetry?.equity === 'number' ? telemetry.equity : null;
  if (!equity || equity <= 0) return { open: false, reason: null };

  const pct = pnlToday / equity;
  if (pct <= -ddLimit) {
    return {
      open: true,
      reason: `Daily DD ${(pct * 100).toFixed(2)}% ($${pnlToday.toFixed(2)} / $${equity.toFixed(2)} equity) ≤ -${(ddLimit * 100).toFixed(0)}% — circuit breaker disparado`,
    };
  }
  return { open: false, reason: null };
}
