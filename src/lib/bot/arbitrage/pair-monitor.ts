// Pair monitor — orquestador de latency arb
//
// Para cada par enabled:
//   1. Verifica circuit breaker diario (risk-guard)
//   2. Lee últimos ticks de live_market_data por cada broker
//   3. Detecta skew (latency-detector)
//   4. Valida pulse (pulse-validator)
//   5. Cierra posiciones expiradas (risk-guard)
//   6. Si todo alinea → emite bot_command OPEN_POSITION al slow account

import type { SupabaseClient } from '@supabase/supabase-js';
import { detectSkew, getPointSize, type Tick } from './latency-detector';
import { validatePulse } from './pulse-validator';
import { isDailyCircuitOpen, listExpiredPositions } from './risk-guard';

export interface ArbPair {
  id:                  string;
  user_id:             string;
  algorithm_id:        string;
  fast_bot_account_id: string;
  slow_bot_account_id: string;
  symbol:              string;
  max_skew_points:     number;
  min_pulse_ticks:     number;
  pulse_window_ms:     number;
  max_hold_seconds:    number;
  min_hold_seconds:    number;
  enabled:             boolean;
}

export interface IterationOutcome {
  pair_id:           string;
  symbol:            string;
  status:            'skip' | 'detected' | 'pulse_failed' | 'circuit_open' | 'opened' | 'closed_expired';
  reason:            string | null;
  signal?:           { direction: 'BUY' | 'SELL'; skew_points: number; alignment: number };
  closed_count?:     number;
}

async function loadRecentTicks(
  sb: SupabaseClient,
  brokerSource: string,
  symbol: string,
  windowMs: number,
): Promise<Tick[]> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data } = await sb
    .from('live_market_data')
    .select('symbol,bid,ask,received_at,source')
    .eq('source', brokerSource)
    .eq('symbol', symbol)
    .gte('received_at', since)
    .order('received_at', { ascending: false })
    .limit(50);
  if (!data?.length) return [];
  return data.map((row) => ({
    broker_id: row.source as string,
    symbol:    row.symbol as string,
    bid:       Number(row.bid),
    ask:       Number(row.ask),
    ts_ms:     new Date(row.received_at as string).getTime(),
  }));
}

async function getBrokerSource(sb: SupabaseClient, botAccountId: string): Promise<string | null> {
  const { data } = await sb
    .from('bot_accounts')
    .select('account_id')
    .eq('id', botAccountId)
    .maybeSingle();
  return (data?.account_id as string) ?? null;
}

async function emitOpenCommand(
  sb: SupabaseClient,
  pair: ArbPair,
  direction: 'BUY' | 'SELL',
  signalMeta: Record<string, unknown>,
): Promise<void> {
  // Necesitamos el bot_id del slow_bot_account
  const { data: slowAcc } = await sb
    .from('bot_accounts')
    .select('bot_id')
    .eq('id', pair.slow_bot_account_id)
    .maybeSingle();
  if (!slowAcc) throw new Error('slow_bot_account no encontrado');

  await sb.from('bot_commands').insert({
    bot_id:        slowAcc.bot_id,
    command_type:  'OPEN_POSITION',
    target_scope:  pair.slow_bot_account_id,
    created_by:    pair.user_id,
    status:        'pending',
    payload:       {
      symbol:           pair.symbol,
      direction,
      max_hold_seconds: pair.max_hold_seconds,
      source:           'latency_arb',
      pair_id:          pair.id,
      algorithm_id:     pair.algorithm_id,
      ...signalMeta,
    },
  });
  await sb.from('arbitrage_latency_pairs')
    .update({ last_signal_at: new Date().toISOString() })
    .eq('id', pair.id);
}

async function closeExpiredPosition(
  sb: SupabaseClient,
  pair: ArbPair,
  positionRef: string,
): Promise<void> {
  const { data: slowAcc } = await sb
    .from('bot_accounts')
    .select('bot_id')
    .eq('id', pair.slow_bot_account_id)
    .maybeSingle();
  if (!slowAcc) return;

  await sb.from('bot_commands').insert({
    bot_id:        slowAcc.bot_id,
    command_type:  'CLOSE_POSITION',
    target_scope:  pair.slow_bot_account_id,
    created_by:    pair.user_id,
    status:        'pending',
    payload:       { ticket: positionRef, reason: 'max_hold_seconds_exceeded', pair_id: pair.id },
  });
}

/**
 * Ejecuta una iteración del monitor para todos los pairs enabled del usuario.
 */
export async function runIteration(
  sb: SupabaseClient,
  userId: string,
): Promise<IterationOutcome[]> {
  const { data: pairs } = await sb
    .from('arbitrage_latency_pairs')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true);
  if (!pairs?.length) return [];

  const outcomes: IterationOutcome[] = [];

  for (const raw of pairs as ArbPair[]) {
    const pair = raw;

    // 1. Circuit breaker diario
    const circuit = await isDailyCircuitOpen(sb, pair.algorithm_id, pair.slow_bot_account_id, 0.05);
    if (circuit.open) {
      outcomes.push({ pair_id: pair.id, symbol: pair.symbol, status: 'circuit_open', reason: circuit.reason });
      continue;
    }

    // 2. Cierre de posiciones expiradas (siempre)
    const expired = await listExpiredPositions(sb, {
      algorithm_id:        pair.algorithm_id,
      user_id:             pair.user_id,
      fast_bot_account_id: pair.fast_bot_account_id,
      slow_bot_account_id: pair.slow_bot_account_id,
      max_hold_seconds:    pair.max_hold_seconds,
      min_hold_seconds:    pair.min_hold_seconds,
    });
    for (const e of expired) await closeExpiredPosition(sb, pair, e.position_ref);
    if (expired.length > 0) {
      outcomes.push({ pair_id: pair.id, symbol: pair.symbol, status: 'closed_expired', reason: `${expired.length} positions over hold limit`, closed_count: expired.length });
    }

    // 3. Cargar ticks
    const [fastSrc, slowSrc] = await Promise.all([
      getBrokerSource(sb, pair.fast_bot_account_id),
      getBrokerSource(sb, pair.slow_bot_account_id),
    ]);
    if (!fastSrc || !slowSrc) {
      outcomes.push({ pair_id: pair.id, symbol: pair.symbol, status: 'skip', reason: 'broker source no resuelto' });
      continue;
    }

    const [fastTicks, slowTicks] = await Promise.all([
      loadRecentTicks(sb, fastSrc, pair.symbol, pair.pulse_window_ms + 2000),
      loadRecentTicks(sb, slowSrc, pair.symbol, 2000),
    ]);
    if (!fastTicks.length || !slowTicks.length) {
      outcomes.push({ pair_id: pair.id, symbol: pair.symbol, status: 'skip', reason: 'sin ticks recientes' });
      continue;
    }

    // 4. Detectar skew con el último tick de cada broker
    const skewSignal = detectSkew(fastTicks[0], slowTicks[0], {
      max_skew_points: pair.max_skew_points,
      point_size:      getPointSize(pair.symbol),
    });
    if (!skewSignal) {
      outcomes.push({ pair_id: pair.id, symbol: pair.symbol, status: 'skip', reason: 'sin skew' });
      continue;
    }

    // 5. Validar pulse en el broker rápido
    const pulse = validatePulse(fastTicks, skewSignal, {
      min_pulse_ticks: pair.min_pulse_ticks,
      pulse_window_ms: pair.pulse_window_ms,
      min_alignment:   0.8,
    });
    if (!pulse.valid) {
      outcomes.push({
        pair_id: pair.id, symbol: pair.symbol, status: 'pulse_failed', reason: pulse.reason,
        signal: { direction: skewSignal.direction, skew_points: skewSignal.skew_points, alignment: pulse.alignment },
      });
      continue;
    }

    // 6. Emitir comando OPEN al slow account
    await emitOpenCommand(sb, pair, skewSignal.direction, {
      skew_points:   skewSignal.skew_points,
      pulse_align:   pulse.alignment,
      pulse_ticks:   pulse.ticks_used,
      detected_at:   skewSignal.detected_at,
    });
    outcomes.push({
      pair_id: pair.id, symbol: pair.symbol, status: 'opened', reason: null,
      signal: { direction: skewSignal.direction, skew_points: skewSignal.skew_points, alignment: pulse.alignment },
    });
  }

  return outcomes;
}
