/**
 * Adaptive Kelly — Superpower #3
 *
 * Auto-adjusts the minimum edge threshold based on recent signal outcomes.
 * The agent becomes more conservative after losing streaks and more
 * aggressive after winning streaks — without human intervention.
 *
 * Mechanism:
 *   - Track last N signal outcomes (win/loss + actual PnL)
 *   - Compute rolling win rate + recent loss streak
 *   - Scale minEdgePercent up or down from the baseline
 *   - Apply regime multiplier from RegimeDetector if available
 */

export interface SignalOutcome {
  conditionId: string;
  edge: number;
  pnlUsd: number;
  won: boolean;
  symbol: string;
  computedAt: number;
}

export interface AdaptiveState {
  currentMinEdge: number;
  baseMinEdge: number;
  multiplier: number;
  winRateRecent: number | null;
  recentLosses: number;
  samplesUsed: number;
  trend: 'TIGHTENING' | 'LOOSENING' | 'STABLE';
  reason: string;
}

export class AdaptiveKelly {
  private history: SignalOutcome[] = [];
  private previousMultiplier = 1.0;

  constructor(
    private readonly baseMinEdge: number,
    private readonly windowSize = 20,
  ) {}

  /**
   * Record the outcome of a closed position (called from PositionTracker).
   */
  recordOutcome(outcome: SignalOutcome): void {
    this.history.push(outcome);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  /**
   * Get the current adaptive minimum edge threshold.
   */
  getCurrentMinEdge(regimeMultiplier = 1.0): number {
    return this.baseMinEdge * this.getMultiplier() * regimeMultiplier;
  }

  /**
   * Compute the performance-based multiplier.
   */
  private getMultiplier(): number {
    if (this.history.length < 5) return 1.0;

    const winRate = this.history.filter(s => s.won).length / this.history.length;
    const last5 = this.history.slice(-5);
    const recentLosses = last5.filter(s => !s.won).length;
    const last3 = this.history.slice(-3);
    const recentLosses3 = last3.filter(s => !s.won).length;

    let multiplier: number;

    if (winRate < 0.35 || recentLosses >= 4) {
      multiplier = 2.0;  // Very bad — require 2x edge to enter
    } else if (winRate < 0.45 || recentLosses >= 3) {
      multiplier = 1.5;
    } else if (winRate < 0.55) {
      multiplier = 1.15;
    } else if (winRate >= 0.70 && recentLosses3 === 0) {
      multiplier = 0.80;  // Excellent — lower threshold (more opportunities)
    } else if (winRate >= 0.60) {
      multiplier = 0.92;
    } else {
      multiplier = 1.0;
    }

    return multiplier;
  }

  getState(regimeMultiplier = 1.0): AdaptiveState {
    const multiplier = this.getMultiplier();
    const winRate = this.history.length > 0
      ? this.history.filter(s => s.won).length / this.history.length
      : null;
    const recentLosses = this.history.slice(-5).filter(s => !s.won).length;

    const trend: AdaptiveState['trend'] =
      multiplier > this.previousMultiplier + 0.05 ? 'TIGHTENING'
      : multiplier < this.previousMultiplier - 0.05 ? 'LOOSENING'
      : 'STABLE';

    this.previousMultiplier = multiplier;

    let reason = 'baseline';
    if (this.history.length < 5) reason = 'insufficient data (<5 signals)';
    else if (multiplier >= 2.0) reason = 'consecutive losses — very high bar';
    else if (multiplier >= 1.5) reason = 'poor win rate — raising bar';
    else if (multiplier >= 1.15) reason = 'below average — slight tightening';
    else if (multiplier <= 0.80) reason = 'excellent streak — relaxing bar';
    else if (multiplier <= 0.92) reason = 'good win rate — slight loosening';

    return {
      currentMinEdge: this.baseMinEdge * multiplier * regimeMultiplier,
      baseMinEdge: this.baseMinEdge,
      multiplier: multiplier * regimeMultiplier,
      winRateRecent: winRate,
      recentLosses,
      samplesUsed: this.history.length,
      trend,
      reason,
    };
  }
}
