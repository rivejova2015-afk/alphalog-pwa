/**
 * C3 — Reversal Radar
 *
 * Activates the jerk (3rd derivative) from momentum-physics.ts in the voting pool.
 * Currently calculateMomentumVector() is computed in loop.ts but never votes.
 *
 * Logic:
 *   REVERSE_LONG  (signal to buy NO):
 *     Price was accelerating UP  (prev_acc > +0.00003)
 *     Jerk turned sharply negative (jerk < -0.00015)
 *     → Momentum collapsing → reversal imminent → vote NO
 *
 *   REVERSE_SHORT (signal to buy YES):
 *     Price was accelerating DOWN (prev_acc < -0.00003)
 *     Jerk turned sharply positive (jerk > +0.00015)
 *     → Selling momentum collapsing → bounce imminent → vote YES
 *
 * Also used by E3 AdaptiveProfitTake to lower the exit threshold when
 * a reversal is detected on an open position.
 */

import { calculateMomentumVector } from '../math/momentum-physics.js';

export interface ReversalSignal {
  reversalImminent: boolean;
  currentMomentumDirection: 'UP' | 'DOWN' | null;
  prevAcceleration: number;
  jerk: number;
  signal: 'REVERSE_LONG' | 'REVERSE_SHORT' | null; // REVERSE_LONG = vote NO
  confidence: number; // 0-1
}

const JERK_REVERSAL_THRESHOLD  = 0.00015;
const ACC_CONFIRMATION_THRESHOLD = 0.00003;

export function computeReversalSignal(
  priceHistory: number[],
  dtSeconds: number = 0.25,
): ReversalSignal {
  if (priceHistory.length < 8) {
    return {
      reversalImminent: false,
      currentMomentumDirection: null,
      prevAcceleration: 0,
      jerk: 0,
      signal: null,
      confidence: 0,
    };
  }

  // Current momentum
  const current = calculateMomentumVector(priceHistory, dtSeconds);

  // Previous acceleration (one tick back) — use slightly older slice
  const prev = calculateMomentumVector(priceHistory.slice(0, -1), dtSeconds);

  const jerk = current.jerk;
  const prevAcc = prev.acceleration;
  const currentAcc = current.acceleration;

  const momentumDir: 'UP' | 'DOWN' | null =
    currentAcc > ACC_CONFIRMATION_THRESHOLD ? 'UP'
    : currentAcc < -ACC_CONFIRMATION_THRESHOLD ? 'DOWN'
    : null;

  let signal: 'REVERSE_LONG' | 'REVERSE_SHORT' | null = null;
  let confidence = 0;

  // REVERSE_LONG: was going up, jerk says "braking hard"
  if (prevAcc > ACC_CONFIRMATION_THRESHOLD && jerk < -JERK_REVERSAL_THRESHOLD) {
    signal = 'REVERSE_LONG';
    confidence = Math.min(1, Math.abs(jerk) / (JERK_REVERSAL_THRESHOLD * 3));
  }
  // REVERSE_SHORT: was going down, jerk says "bounce incoming"
  else if (prevAcc < -ACC_CONFIRMATION_THRESHOLD && jerk > JERK_REVERSAL_THRESHOLD) {
    signal = 'REVERSE_SHORT';
    confidence = Math.min(1, Math.abs(jerk) / (JERK_REVERSAL_THRESHOLD * 3));
  }

  return {
    reversalImminent: signal !== null,
    currentMomentumDirection: momentumDir,
    prevAcceleration: prevAcc,
    jerk,
    signal,
    confidence,
  };
}
