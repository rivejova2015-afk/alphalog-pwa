/**
 * ReliabilityValidator — 8-criterion strategy health scorecard.
 *
 * Pure module. Used independently from Day-10 to answer:
 * "is the strategy still healthy right now?"
 * Each failed criterion subtracts from a starting confidence of 100.
 */

import type { SessionMetrics } from './realtime-metrics.js';

export type Recommendation = 'KEEP_RUNNING' | 'WATCH_CLOSELY' | 'REDUCE_RISK' | 'PAUSE_TRADING';

export interface ReliabilityResult {
  isReliable: boolean;
  confidence: number;
  issues: string[];
  recommendation: Recommendation;
}

interface Criterion {
  id: string;
  passed: boolean;
  penalty: number;
  message: string;
}

export class ReliabilityValidator {
  validateStrategy(metrics: SessionMetrics): ReliabilityResult {
    const criteria: Criterion[] = [
      {
        id: 'sample-size',
        passed: metrics.totalTrades >= 20,
        penalty: 5,
        message: `sample_size=${metrics.totalTrades} (<20)`,
      },
      {
        id: 'win-rate',
        passed: metrics.winRate >= 0.55,
        penalty: 25,
        message: `win_rate=${(metrics.winRate * 100).toFixed(1)}% (<55%)`,
      },
      {
        id: 'expected-value',
        passed: metrics.expectedValue >= 0.005,
        penalty: 20,
        message: `ev=${metrics.expectedValue.toFixed(4)} (<0.5%)`,
      },
      {
        id: 'profit-factor',
        passed: metrics.profitFactor >= 1.3,
        penalty: 15,
        message: `pf=${Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞'} (<1.3)`,
      },
      {
        id: 'sharpe',
        passed: metrics.sharpe >= 0.7,
        penalty: 10,
        message: `sharpe=${metrics.sharpe.toFixed(2)} (<0.7)`,
      },
      {
        id: 'drawdown',
        passed: metrics.maxDrawdown < Math.max(50, Math.abs(metrics.totalPnl) * 0.5),
        penalty: 10,
        message: `max_dd=${metrics.maxDrawdown.toFixed(2)}`,
      },
      {
        id: 'loss-streak',
        passed: metrics.longestLossStreak < 6,
        penalty: 8,
        message: `loss_streak=${metrics.longestLossStreak} (>=6)`,
      },
      {
        id: 'execution',
        passed: metrics.avgExecutionTimeMs < 4000,
        penalty: 7,
        message: `exec_avg_ms=${metrics.avgExecutionTimeMs.toFixed(0)} (>=4000)`,
      },
    ];

    let confidence = 100;
    const issues: string[] = [];
    for (const c of criteria) {
      if (!c.passed) {
        confidence -= c.penalty;
        issues.push(`${c.id}: ${c.message}`);
      }
    }
    confidence = Math.max(0, confidence);

    let recommendation: Recommendation;
    if (confidence >= 85) recommendation = 'KEEP_RUNNING';
    else if (confidence >= 65) recommendation = 'WATCH_CLOSELY';
    else if (confidence >= 45) recommendation = 'REDUCE_RISK';
    else recommendation = 'PAUSE_TRADING';

    return {
      isReliable: confidence >= 65,
      confidence,
      issues,
      recommendation,
    };
  }
}
