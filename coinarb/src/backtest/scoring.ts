/**
 * Pure functions shared by the backtest script and its tests.
 *
 * `scoreOutcome` is the heart of "would this entry have hit TP or SL?".
 * It's intentionally pessimistic: when both stop and target are inside the
 * same 5m bar, it picks SL — real bots can't tell which hit first intrabar
 * without tick data, so assuming the worst keeps backtest results from
 * overstating PnL.
 */

import { RR_MIN } from '../core/config.js';
import type { Candle } from '../analysis/candle-builder.js';

export const STOP_PCT = 0.005;                   // ±0.5% stop distance (matches live loop)
export const TP_PCT = STOP_PCT * RR_MIN;         // 2R take profit
export const FORWARD_HORIZON_5M_BARS = 48;       // 4h max holding period (48 × 5m)

export type Outcome = 'TP' | 'SL' | 'TIMEOUT';

export function scoreOutcome(
  candles: Candle[],
  fromIdx: number,
  direction: 'BUY' | 'SELL',
  entryPrice: number,
): Outcome {
  const stop   = direction === 'BUY' ? entryPrice * (1 - STOP_PCT) : entryPrice * (1 + STOP_PCT);
  const target = direction === 'BUY' ? entryPrice * (1 + TP_PCT)   : entryPrice * (1 - TP_PCT);
  const lastIdx = Math.min(candles.length - 1, fromIdx + FORWARD_HORIZON_5M_BARS);
  for (let j = fromIdx; j <= lastIdx; j++) {
    const c = candles[j];
    if (direction === 'BUY') {
      if (c.low  <= stop)   return 'SL';
      if (c.high >= target) return 'TP';
    } else {
      if (c.high >= stop)   return 'SL';
      if (c.low  <= target) return 'TP';
    }
  }
  return 'TIMEOUT';
}
