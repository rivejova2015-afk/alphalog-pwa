/**
 * Decision tier for the 50x strategy.
 *
 *   ENTER  → full Kelly entry (high gap + high confidence)
 *   SCALP  → ~10% of Kelly entry (borderline gap + medium confidence)
 *   SKIP   → nothing
 *
 * Pure function. The thresholds come from FiftyXParams so they are
 * tunable per-deploy without code changes.
 */

import type { FiveLayerResult } from './five-layer-validator.js';
import type { FiftyXParams } from './config-50x.js';

export type Decision = 'ENTER' | 'SCALP' | 'SKIP';

export interface DecisionResult {
  decision: Decision;
  reason: string;
  absGap: number;
  confidence: number;
}

export function decide(
  gap: number,
  fiveLayer: FiveLayerResult,
  params: FiftyXParams,
): DecisionResult {
  const absGap = Math.abs(gap);
  const conf = fiveLayer.overallConfidence;
  const validated = fiveLayer.validatedCount;

  if (
    absGap >= params.enterMinGap &&
    conf >= params.enterMinConfidence &&
    validated >= params.enterMinValidatedCount
  ) {
    return {
      decision: 'ENTER',
      reason: `gap=${(absGap * 100).toFixed(2)}% conf=${conf.toFixed(2)} layers=${validated}/5 → ENTER`,
      absGap,
      confidence: conf,
    };
  }

  if (
    absGap >= params.scalpMinGap &&
    conf >= params.scalpMinConfidence &&
    validated >= params.scalpMinValidatedCount
  ) {
    return {
      decision: 'SCALP',
      reason: `gap=${(absGap * 100).toFixed(2)}% conf=${conf.toFixed(2)} layers=${validated}/5 → SCALP`,
      absGap,
      confidence: conf,
    };
  }

  let skipReason: string;
  if (absGap < params.scalpMinGap) {
    skipReason = `gap=${(absGap * 100).toFixed(2)}% < ${(params.scalpMinGap * 100).toFixed(2)}% → SKIP`;
  } else if (conf < params.scalpMinConfidence) {
    skipReason = `conf=${conf.toFixed(2)} < ${params.scalpMinConfidence.toFixed(2)} → SKIP`;
  } else {
    skipReason = `layers=${validated}/5 < ${params.scalpMinValidatedCount} → SKIP`;
  }

  return {
    decision: 'SKIP',
    reason: skipReason,
    absGap,
    confidence: conf,
  };
}
