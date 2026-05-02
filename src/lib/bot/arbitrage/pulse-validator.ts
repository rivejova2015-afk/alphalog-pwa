// Pulse validator
//
// Confirma que el skew detectado en latency-detector es momentum sostenido,
// no un flicker de un solo tick. Mira los últimos `min_pulse_ticks` del broker
// rápido dentro de `pulse_window_ms` y exige que >=80% del movimiento sea en
// la misma dirección que el skew.

import type { Tick, SkewSignal } from './latency-detector';

export interface PulseConfig {
  min_pulse_ticks:  number;
  pulse_window_ms:  number;
  min_alignment:    number; // 0-1, default 0.8
}

export interface PulseResult {
  valid:         boolean;
  alignment:     number;
  ticks_used:    number;
  reason:        string | null;
}

/**
 * Valida que los últimos N ticks del broker rápido confirman la dirección del skew.
 * Algoritmo: contar tick-to-tick deltas en la dirección del signal vs contraria.
 */
export function validatePulse(
  fastTicks: Tick[],
  signal: SkewSignal,
  config: PulseConfig,
): PulseResult {
  const cutoff = signal.detected_at - config.pulse_window_ms;
  const recent = fastTicks
    .filter((t) => t.ts_ms >= cutoff && t.ts_ms <= signal.detected_at && t.symbol === signal.symbol)
    .sort((a, b) => a.ts_ms - b.ts_ms);

  if (recent.length < config.min_pulse_ticks) {
    return { valid: false, alignment: 0, ticks_used: recent.length, reason: `Solo ${recent.length} ticks en ventana (req ${config.min_pulse_ticks})` };
  }

  let alignedDeltas  = 0;
  let opposingDeltas = 0;
  for (let i = 1; i < recent.length; i++) {
    const delta = recent[i].bid - recent[i - 1].bid;
    if (delta === 0) continue;
    const sameDirection =
      (signal.direction === 'BUY'  && delta > 0) ||
      (signal.direction === 'SELL' && delta < 0);
    if (sameDirection) alignedDeltas++;
    else opposingDeltas++;
  }

  const total = alignedDeltas + opposingDeltas;
  if (total === 0) {
    return { valid: false, alignment: 0, ticks_used: recent.length, reason: 'Todos los ticks idénticos (zero deltas)' };
  }

  const alignment = alignedDeltas / total;
  const minAlignment = config.min_alignment ?? 0.8;
  return {
    valid:      alignment >= minAlignment,
    alignment:  Number(alignment.toFixed(3)),
    ticks_used: recent.length,
    reason:     alignment >= minAlignment ? null : `Alignment ${alignment.toFixed(2)} < ${minAlignment}`,
  };
}
