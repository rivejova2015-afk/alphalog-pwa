/**
 * E3 — Adaptive Profit-Take
 *
 * Replaces the fixed PROFIT_TAKE_PCT = 0.70 in checkProfitTakeExits().
 * Dynamically adjusts between 60-85% based on market conditions.
 *
 * Logic:
 *   DIRECTIONAL entropy → let winner run → raise threshold (up to 85%)
 *   NOISY entropy → take profit early → lower threshold
 *   Reversal imminent (C3 jerk signal) → exit ASAP → lower threshold
 *   Time pressure (< 90s in window) → lower threshold
 *   VOLATILE regime → lower threshold
 *   CALM regime → raise threshold
 */

import type { EntropySignal } from './entropy-detector.js';
import type { ReversalSignal } from './reversal-radar.js';
import type { RegimeState } from './regime-detector.js';
import type { EventState } from './event-detector.js';

export interface AdaptiveProfitTakeResult {
  threshold: number;         // 0.30-0.85 (event mode expands floor)
  reason: string;            // human-readable explanation
  entropyFactor: number;     // contribution from entropy
  reversalFactor: number;    // contribution from reversal radar
  timeFactor: number;        // contribution from time pressure
  regimeFactor: number;      // contribution from regime
  eventFactor: number;       // contribution from event override
}

const BASE_PCT     = 0.70;
const MIN_PCT      = 0.60;
const MAX_PCT      = 0.85;

// Event-mode envelopes
const EVENT_HIGH_MIN  = 0.30;   // severity > 0.7
const EVENT_HIGH_MAX  = 0.70;
const EVENT_MID_MIN   = 0.45;   // 0.4 < severity <= 0.7
const EVENT_MID_MAX   = 0.75;

export function computeProfitTakePct(
  entropySignal: EntropySignal | null,
  reversalSignal: ReversalSignal | null,
  msLeftInWindow: number,
  regime: RegimeState | null,
  eventState: EventState | null = null,
  flagAggressive: boolean = false,
): AdaptiveProfitTakeResult {
  let pct = BASE_PCT;
  const reasons: string[] = [];
  let entropyFactor = 0;
  let reversalFactor = 0;
  let timeFactor = 0;
  let regimeFactor = 0;
  let eventFactor = 0;

  // Entropy contribution
  if (entropySignal) {
    if (entropySignal.regime === 'DIRECTIONAL' && entropySignal.confidence > 0.3) {
      const adj = 0.12 * entropySignal.confidence;
      pct += adj;
      entropyFactor = adj;
      reasons.push(`DIRECTIONAL(+${(adj * 100).toFixed(0)}%)`);
    } else if (entropySignal.regime === 'NOISY' && entropySignal.confidence > 0.3) {
      const adj = -0.08 * entropySignal.confidence;
      pct += adj;
      entropyFactor = adj;
      reasons.push(`NOISY(${(adj * 100).toFixed(0)}%)`);
    }
  }

  // Reversal radar contribution
  if (reversalSignal?.reversalImminent) {
    const adj = -0.15 * reversalSignal.confidence;
    pct += adj;
    reversalFactor = adj;
    reasons.push(`REVERSAL(${(adj * 100).toFixed(0)}%)`);
  }

  // Time pressure
  if (msLeftInWindow < 90_000) {
    const urgency = 1 - msLeftInWindow / 90_000;
    const adj = -0.10 * urgency;
    pct += adj;
    timeFactor = adj;
    reasons.push(`TIME_PRESSURE(${(adj * 100).toFixed(0)}%)`);
  }

  // Regime contribution
  if (regime) {
    if (regime.regime === 'VOLATILE' || regime.regime === 'CRISIS') {
      const adj = -0.08;
      pct += adj;
      regimeFactor = adj;
      reasons.push(`${regime.regime}(${(adj * 100).toFixed(0)}%)`);
    } else if (regime.regime === 'CALM') {
      const adj = 0.05;
      pct += adj;
      regimeFactor = adj;
      reasons.push(`CALM(+${(adj * 100).toFixed(0)}%)`);
    }
  }

  // Event override — applied LAST, expands the clamp envelope.
  let minEnvelope = MIN_PCT;
  let maxEnvelope = MAX_PCT;
  if (flagAggressive && eventState?.active) {
    if (eventState.severity > 0.7) {
      // High-severity event: let winner run unless reversal kicks in.
      const reversalDetected = reversalSignal?.reversalImminent ?? false;
      const target = reversalDetected ? EVENT_HIGH_MIN : EVENT_HIGH_MAX - 0.10;
      const adj = target - pct;
      pct = target;
      eventFactor = adj;
      minEnvelope = EVENT_HIGH_MIN;
      maxEnvelope = EVENT_HIGH_MAX;
      reasons.push(`EVENT_HIGH(${eventState.type ?? 'unknown'},sev=${eventState.severity.toFixed(2)})`);
    } else if (eventState.severity > 0.4) {
      // Mid-severity: shift band down by ~10% from baseline.
      const adj = -0.10;
      pct += adj;
      eventFactor = adj;
      minEnvelope = EVENT_MID_MIN;
      maxEnvelope = EVENT_MID_MAX;
      reasons.push(`EVENT_MID(${eventState.type ?? 'unknown'},${(adj * 100).toFixed(0)}%)`);
    }
  }

  const threshold = Math.max(minEnvelope, Math.min(maxEnvelope, pct));
  const reason = reasons.length > 0
    ? `base=${(BASE_PCT * 100).toFixed(0)}% ${reasons.join(' ')} → ${(threshold * 100).toFixed(0)}%`
    : `base=${(BASE_PCT * 100).toFixed(0)}%`;

  return { threshold, reason, entropyFactor, reversalFactor, timeFactor, regimeFactor, eventFactor };
}
