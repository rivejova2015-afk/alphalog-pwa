/**
 * C1 — Adaptive Consensus Threshold
 *
 * Makes MIN_ENGINE_VOTES and MIN_SCORE_MARGIN dynamic instead of hardcoded.
 * The bot becomes stricter when losing (protect capital) and slightly looser
 * when winning (exploit the edge while conditions are favorable).
 *
 * Absolute floors are always enforced:
 *   minEngineVotes >= 3  (never below this regardless of win rate)
 *   minScoreMargin >= 0.45
 */

export interface ConsensusThresholds {
  minEngineVotes: number;
  minScoreMargin: number;
  winRateUsed: number;
  sampleCount: number;
  mode: 'STRICT' | 'BASELINE' | 'LOOSE';
}

const ABS_MIN_VOTES  = 3;
const ABS_MIN_MARGIN = 0.45;

export function computeConsensusThresholds(
  recentWinRate: number,
  sampleCount: number,
  totalActiveVoters: number,
): ConsensusThresholds {
  // Use baseline if too few samples to trust the win rate
  const effectiveWinRate = sampleCount < 10 ? 0.50 : recentWinRate;

  let voteFraction: number;
  let minScoreMargin: number;
  let mode: 'STRICT' | 'BASELINE' | 'LOOSE';

  if (effectiveWinRate >= 0.75) {
    voteFraction = 0.55;
    minScoreMargin = 0.45;
    mode = 'LOOSE';
  } else if (effectiveWinRate >= 0.60) {
    voteFraction = 0.60;
    minScoreMargin = 0.55;
    mode = 'BASELINE';
  } else if (effectiveWinRate >= 0.45) {
    voteFraction = 0.65;
    minScoreMargin = 0.60;
    mode = 'BASELINE';
  } else {
    voteFraction = 0.75;
    minScoreMargin = 0.75;
    mode = 'STRICT';
  }

  const computed = Math.ceil(totalActiveVoters * voteFraction);
  const minEngineVotes = Math.max(ABS_MIN_VOTES, computed);
  const clampedMargin  = Math.max(ABS_MIN_MARGIN, minScoreMargin);

  return {
    minEngineVotes,
    minScoreMargin: clampedMargin,
    winRateUsed: effectiveWinRate,
    sampleCount,
    mode,
  };
}

/**
 * Compute recent win rate from last N outcomes.
 * Used to feed computeConsensusThresholds().
 */
export function recentWinRate(metrics: {
  wins: number;
  losses: number;
  totalTrades: number;
}, windowSize = 30): { winRate: number; sampleCount: number } {
  const sampleCount = Math.min(metrics.totalTrades, windowSize);
  if (sampleCount === 0) return { winRate: 0.5, sampleCount: 0 };

  // Approximate: use global ratio as proxy for recent window
  // Full implementation would track a rolling window of outcomes
  const winRate = metrics.totalTrades > 0
    ? metrics.wins / metrics.totalTrades
    : 0.5;

  return { winRate, sampleCount };
}
