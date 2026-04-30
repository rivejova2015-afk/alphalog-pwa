/**
 * Kelly adjuster (50x strategy).
 *
 * Wraps `asymmetricKelly()` from polyarb/src/math. After getting the base
 * fraction, applies four orthogonal multipliers:
 *
 *   gap        — bigger edge → bigger size (capped at 1.5×)
 *   confidence — higher five-layer score → bigger size (capped at 1.3×)
 *   streak     — win streak boost (capped at 1.25×) / drawdown reduction
 *   tier       — SCALP gets `scalpKellyMultiplier` (e.g. 0.10)
 *
 * Final fraction is clamped at the production engine's effective ceiling
 * (event-aware) — we never exceed `params.maxKellyFractionEvent` (0.40)
 * and never exceed the supplied per-tick `ceiling`. Risk is not removed,
 * just sized — the existing statistical-CB still pauses on systemic failure.
 */

import type { Decision } from './decision-tier.js';
import type { FiftyXParams } from './config-50x.js';

export interface KellyAdjustInput {
  /** Output of asymmetricKelly().fraction — already capped by maxFraction. */
  baseFraction: number;
  /** |adjustedFairProb - marketPrice|. */
  gap: number;
  /** Five-layer overall confidence (0..1). */
  confidence: number;
  /** Consecutive win count from metrics. */
  consecutiveWins: number;
  /** Drawdown as a positive fraction (0.10 = 10% drawdown). */
  drawdown: number;
  decision: Decision;
  /** Per-tick effective Kelly cap (event-aware). */
  ceiling: number;
  params: FiftyXParams;
  /** Session multiplier (e.g. 2.5 for London+NY overlap). Defaults to 1. */
  sessionMultiplier?: number;
}

export interface KellyAdjustResult {
  fraction: number;
  multipliers: {
    gap: number;
    confidence: number;
    streak: number;
    drawdown: number;
    tier: number;
    session: number;
  };
}

const GAP_BOOST_REF = 0.04;        // 4% gap → ~1.5× boost cap
const GAP_MULT_MAX = 1.5;
const CONF_MULT_MAX = 1.3;
const STREAK_MULT_MAX = 1.25;
const DRAWDOWN_REF = 0.20;         // 20% drawdown → multiplier hits floor
const DRAWDOWN_FLOOR = 0.50;

export function adjustKelly(input: KellyAdjustInput): KellyAdjustResult {
  // Gap multiplier — 0%→1.0, 4%+→1.5
  const gapMult = Math.min(
    GAP_MULT_MAX,
    1 + (Math.abs(input.gap) / GAP_BOOST_REF) * (GAP_MULT_MAX - 1),
  );

  // Confidence multiplier — 0.5→1.0, 1.0→1.3
  const confNorm = Math.max(0, Math.min(1, (input.confidence - 0.5) / 0.5));
  const confMult = 1 + confNorm * (CONF_MULT_MAX - 1);

  // Streak multiplier — 1.0 baseline, +5% per win up to +25%
  const streakMult = Math.min(STREAK_MULT_MAX, 1 + Math.max(0, input.consecutiveWins) * 0.05);

  // Drawdown multiplier — scales DOWN sizing, never to zero (sizing, not blocking)
  const ddNorm = Math.max(0, Math.min(1, input.drawdown / DRAWDOWN_REF));
  const drawdownMult = 1 - ddNorm * (1 - DRAWDOWN_FLOOR);

  // Tier multiplier — SCALP gets fractional Kelly
  const tierMult = input.decision === 'SCALP' ? input.params.scalpKellyMultiplier : 1;

  // Session multiplier — flooring/raising by trading session (default 1)
  const sessionMult = Number.isFinite(input.sessionMultiplier) && (input.sessionMultiplier ?? 0) > 0
    ? Number(input.sessionMultiplier)
    : 1;

  let fraction =
    input.baseFraction * gapMult * confMult * streakMult * drawdownMult * tierMult * sessionMult;

  // Clamp to ceiling AND production cap — never exceed the event-aware cap.
  // The session multiplier is a floor-raiser, not a ceiling-buster; this clamp
  // is what prevents 2.5× from running away on a high-edge tick.
  const hardCap = Math.max(input.ceiling, input.params.maxKellyFraction);
  fraction = Math.max(0, Math.min(fraction, hardCap, input.params.maxKellyFractionEvent));

  return {
    fraction,
    multipliers: {
      gap: gapMult,
      confidence: confMult,
      streak: streakMult,
      drawdown: drawdownMult,
      tier: tierMult,
      session: sessionMult,
    },
  };
}
