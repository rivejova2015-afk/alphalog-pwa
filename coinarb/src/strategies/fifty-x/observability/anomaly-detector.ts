/**
 * AnomalyDetector — z-score outlier detection over recent trades.
 *
 * Pure module. Caller passes the new trade record + a stats summary
 * (mean/stdev for ev and slippage); detector returns severity + reasons.
 */

import type { TradeRecord } from './realtime-metrics.js';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HistoricalStats {
  evMean: number;
  evStd: number;
  slippageMean: number;
  slippageStd: number;
  execTimeMean: number;
  execTimeStd: number;
  sampleSize: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  reasons: string[];
  severity: Severity;
}

const Z_HIGH = 2.5;
const Z_CRITICAL = 3.5;

function escalate(current: Severity, next: Severity): Severity {
  const order: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}

function zscore(value: number, mean: number, std: number): number {
  if (!Number.isFinite(std) || std <= 0) return 0;
  return (value - mean) / std;
}

export class AnomalyDetector {
  /**
   * Compute mean+stdev over a slice of historical trades.
   * Returns sample-friendly stats (sampleSize <= 5 -> std = 0).
   */
  static computeStats(history: readonly TradeRecord[]): HistoricalStats {
    const n = history.length;
    if (n === 0) {
      return {
        evMean: 0, evStd: 0,
        slippageMean: 0, slippageStd: 0,
        execTimeMean: 0, execTimeStd: 0,
        sampleSize: 0,
      };
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const std  = (xs: number[], m: number) =>
      Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);

    const ev   = history.map((x) => x.expectedValue);
    const sl   = history.map((x) => x.slippage);
    const ex   = history.map((x) => x.executionTimeMs);

    const evM = mean(ev);
    const slM = mean(sl);
    const exM = mean(ex);

    return {
      evMean: evM,
      evStd: n >= 5 ? std(ev, evM) : 0,
      slippageMean: slM,
      slippageStd: n >= 5 ? std(sl, slM) : 0,
      execTimeMean: exM,
      execTimeStd: n >= 5 ? std(ex, exM) : 0,
      sampleSize: n,
    };
  }

  detectAnomalies(trade: TradeRecord, stats: HistoricalStats): AnomalyResult {
    const reasons: string[] = [];
    let severity: Severity = 'LOW';

    if (stats.sampleSize >= 5) {
      const evZ = Math.abs(zscore(trade.expectedValue, stats.evMean, stats.evStd));
      if (evZ > Z_HIGH) {
        reasons.push(`EV_ZSCORE_${evZ.toFixed(2)}`);
        severity = escalate(severity, evZ > Z_CRITICAL ? 'CRITICAL' : 'HIGH');
      }

      const slZ = Math.abs(zscore(trade.slippage, stats.slippageMean, stats.slippageStd));
      if (slZ > Z_HIGH) {
        reasons.push(`SLIPPAGE_ZSCORE_${slZ.toFixed(2)}`);
        severity = escalate(severity, slZ > Z_CRITICAL ? 'CRITICAL' : 'HIGH');
      }

      const exZ = Math.abs(zscore(trade.executionTimeMs, stats.execTimeMean, stats.execTimeStd));
      if (exZ > Z_HIGH) {
        reasons.push(`EXEC_ZSCORE_${exZ.toFixed(2)}`);
        severity = escalate(severity, exZ > Z_CRITICAL ? 'CRITICAL' : 'HIGH');
      }
    }

    if (trade.executionTimeMs > 5000) {
      reasons.push(`EXEC_OVER_5S_${trade.executionTimeMs}ms`);
      severity = escalate(severity, 'MEDIUM');
    }

    // Suspicious patterns: low confidence yet won big, or low validation but won
    if (trade.pnl > 0 && trade.confidence < 0.55) {
      reasons.push(`LOW_CONF_WIN_${trade.confidence.toFixed(2)}`);
      severity = escalate(severity, 'MEDIUM');
    }

    return {
      isAnomaly: reasons.length > 0,
      reasons,
      severity,
    };
  }
}
