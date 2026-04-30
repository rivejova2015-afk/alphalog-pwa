/**
 * 5-Layer Opportunity Validator (50x strategy)
 *
 * Pure scoring module. Sits *after* the production 14-engine vote and
 * computes five orthogonal aspect scores so the decision-tier can split
 * opportunities into ENTER vs SCALP rather than a binary enter/skip.
 *
 *   L1 realness       — gap exceeds the regime's noise floor
 *   L2 duration       — estimated correction time long enough to capture
 *   L3 reversal_risk  — inverse of jerk-based reversal probability
 *   L4 capital_fit    — gap relative to minimum edge threshold
 *   L5 exit_clarity   — enough window left + reversal risk acceptable
 *
 * Never throws. Failure path returns zero confidence so decision-tier
 * naturally returns SKIP.
 */

import type { RegimeState } from '../../skills/regime-detector.js';
import type { ReversalSignal } from '../../skills/reversal-radar.js';

export type LayerName =
  | 'realness'
  | 'duration'
  | 'reversal_risk'
  | 'capital_fit'
  | 'exit_clarity';

export interface LayerScore {
  layer: 1 | 2 | 3 | 4 | 5;
  name: LayerName;
  score: number;     // 0..1
  isValid: boolean;  // score >= layer-specific threshold
  reason: string;
}

export interface FiveLayerResult {
  layers: LayerScore[];
  /** Mean of validated layer scores (0 if none valid). */
  overallConfidence: number;
  validatedCount: number;
}

const VALID_THRESHOLD: Record<LayerName, number> = {
  realness: 0.6,
  duration: 0.5,
  reversal_risk: 0.6,
  capital_fit: 0.5,
  exit_clarity: 0.6,
};

function scoreLayer(
  layer: 1 | 2 | 3 | 4 | 5,
  name: LayerName,
  score: number,
  reason: string,
): LayerScore {
  const clamped = Math.max(0, Math.min(1, score));
  return {
    layer,
    name,
    score: clamped,
    isValid: clamped >= VALID_THRESHOLD[name],
    reason,
  };
}

export interface FiveLayerInput {
  /** Signed gap = adjustedFairProb - marketPrice (range roughly -1..1). */
  gap: number;
  regime: RegimeState | null;
  reversal: ReversalSignal | null;
  /** Milliseconds remaining in the current 5-min Polymarket window. */
  msLeftInWindow: number;
  /** Minimum edge fraction the production engine requires (params.minEdgePercent). */
  minEdgePercent: number;
}

export function validate(input: FiveLayerInput): FiveLayerResult {
  try {
    const absGap = Math.abs(input.gap);

    // L1 — realness: gap must exceed roughly half the regime's volatility band.
    // Higher vol regimes require a bigger gap to be considered "real" rather than noise.
    const volPct = input.regime?.volatilityPct ?? 30;
    const noiseFloor = (volPct / 100) * 0.005;          // 30% vol → ~0.0015 noise floor
    const realness = noiseFloor > 0
      ? Math.min(1, absGap / (noiseFloor * 4))
      : Math.min(1, absGap / 0.015);
    const l1 = scoreLayer(
      1,
      'realness',
      realness,
      `gap=${(absGap * 100).toFixed(2)}% vs noise=${(noiseFloor * 100).toFixed(2)}%`,
    );

    // L2 — duration: estimated correction time is roughly inverse to volatility.
    // Hot markets correct fast, scoring lower; calm markets give us more room.
    const mult = input.regime?.agentMultiplier ?? 1;
    const duration = Math.max(0, Math.min(1, mult));     // 1.3 → 1.0 (capped), 0.2 → 0.2
    const l2 = scoreLayer(
      2,
      'duration',
      duration,
      `regime=${input.regime?.regime ?? 'UNKNOWN'} mult=${mult.toFixed(2)}`,
    );

    // L3 — reversal_risk: 1 minus the jerk-based reversal confidence.
    // No reversal signal → maximum score; strong reversal → near zero.
    const reversalProb = input.reversal?.reversalImminent
      ? input.reversal.confidence
      : 0;
    const reversalScore = 1 - reversalProb;
    const l3 = scoreLayer(
      3,
      'reversal_risk',
      reversalScore,
      input.reversal?.reversalImminent
        ? `reversal=${input.reversal.signal} conf=${reversalProb.toFixed(2)}`
        : 'no reversal',
    );

    // L4 — capital_fit: gap as a multiple of the engine's minEdgePercent.
    // gap == minEdge → 0.5, gap >= 3× minEdge → 1.0.
    const min = Math.max(0.005, input.minEdgePercent || 0.03);
    const capitalFit = Math.min(1, absGap / (min * 3));
    const l4 = scoreLayer(
      4,
      'capital_fit',
      capitalFit,
      `gap=${(absGap * 100).toFixed(2)}% / 3×minEdge=${(min * 3 * 100).toFixed(2)}%`,
    );

    // L5 — exit_clarity: enough window remains (≥60s) AND reversal risk OK (L3 ≥ 0.6).
    const msLeft = Math.max(0, input.msLeftInWindow);
    const timeScore = Math.min(1, msLeft / 120_000);     // 2 min → 1.0
    const exitScore = Math.min(timeScore, l3.score);
    const l5 = scoreLayer(
      5,
      'exit_clarity',
      exitScore,
      `msLeft=${msLeft} timeScore=${timeScore.toFixed(2)} reversalScore=${l3.score.toFixed(2)}`,
    );

    const layers: LayerScore[] = [l1, l2, l3, l4, l5];
    const valid = layers.filter(l => l.isValid);
    const overallConfidence =
      valid.length > 0
        ? valid.reduce((s, l) => s + l.score, 0) / valid.length
        : 0;

    return {
      layers,
      overallConfidence,
      validatedCount: valid.length,
    };
  } catch {
    return { layers: [], overallConfidence: 0, validatedCount: 0 };
  }
}
