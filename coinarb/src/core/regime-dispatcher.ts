/**
 * Regime → strategy dispatcher (pure).
 *
 * Decides which runner the coordinator should fire for the current market
 * regime. Lives in its own module so the mapping table is easy to test in
 * isolation without spinning up the WS feeds, broker, or the loop.
 *
 * Mapping (Phase 2.3 — DD descartada; backtest sobre datos reales de
 * Coinbase (1m/5m/15m, múltiples configs) mostró que la señal de entrada
 * de DD — pullback EMA20 + rejection candle + sesgo de dirección diaria —
 * no tiene ventaja direccional demostrable en ningún timeframe probado
 * (win rate converge a ~23% con muestra grande, muy por debajo del ~55%
 * necesario para R:R 3:1). Revertido al mapping pre-DD, que usa las
 * strategies con lógica SMC/mean-rev/momentum más elaborada:
 *   TRENDING_HIGH → 'B' (SMC aggressive — sweep cleanest in directional vol)
 *   TRENDING_LOW  → 'P' (momentum-breakout — clean grind, low chop)
 *   RANGE_HIGH    → 'M' (mean-reversion — BB + RSI; SMC gates rechazan
 *                        ~100% acá porque sin tendencia no se forma EQH/EQL)
 *   RANGE_LOW     → 'M' (mean-reversion — BB + RSI extremes work here)
 *   DEAD          → 'pause' (no market — skip every symbol)
 *
 * DD queda instanciada en el coordinator (loop.ts) + su código intacto por
 * si una futura iteración quiere rediseñar la lógica de entrada.
 */

import type { Regime } from '../analysis/regime-detector.js';
import type { StrategyId } from '../trading/spot-positions.js';

export type DispatchTarget = StrategyId | 'pause';

export const REGIME_TO_STRATEGY: Record<Regime, DispatchTarget> = {
  TRENDING_HIGH: 'B',
  TRENDING_LOW: 'P',
  RANGE_HIGH: 'M',
  RANGE_LOW: 'M',
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
