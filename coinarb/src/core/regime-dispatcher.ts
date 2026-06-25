/**
 * Regime → strategy dispatcher (pure).
 *
 * Decides which runner the coordinator should fire for the current market
 * regime. Lives in its own module so the mapping table is easy to test in
 * isolation without spinning up the WS feeds, broker, or the loop.
 *
 * Mapping (Phase 2.2 — Strategy DD activado en todos los regímenes
 * operables por spec del owner; ~100 ops/día target con risk real 4%):
 *   TRENDING_HIGH → 'DD' (Daily Direction Scalper)
 *   TRENDING_LOW  → 'DD'
 *   RANGE_HIGH    → 'DD'
 *   RANGE_LOW     → 'DD'
 *   DEAD          → 'pause' (no market — skip every symbol)
 *
 * Las strategies A/B/M/P quedan instanciadas en el coordinator (loop.ts) por
 * si futuras iteraciones requieren revertir el mapping o agregar fan-out
 * multi-strategy.
 */

import type { Regime } from '../analysis/regime-detector.js';
import type { StrategyId } from '../trading/spot-positions.js';

export type DispatchTarget = StrategyId | 'pause';

export const REGIME_TO_STRATEGY: Record<Regime, DispatchTarget> = {
  TRENDING_HIGH: 'DD',
  TRENDING_LOW: 'DD',
  RANGE_HIGH: 'DD',
  RANGE_LOW: 'DD',
  DEAD: 'pause',
};

export function dispatchTargetFor(regime: Regime): DispatchTarget {
  return REGIME_TO_STRATEGY[regime];
}

/**
 * The strategies that may run on each regime — used to scope cap counting
 * and telemetry. Always returns at most one strategy per regime in Phase 2;
 * a future Phase could fan-out (e.g. always run A on every regime as a
 * baseline) by returning multiple ids here.
 */
export function strategiesForRegime(regime: Regime): readonly StrategyId[] {
  const target = REGIME_TO_STRATEGY[regime];
  return target === 'pause' ? [] : [target];
}
