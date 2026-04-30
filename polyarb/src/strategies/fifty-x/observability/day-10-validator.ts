/**
 * Day10Validator — automatic Day-10 reliability gate for the 500x strategy.
 *
 * On day 10 (between 18:00 and 21:00 UTC), once per agent, runs the
 * five hard-rule checks. If passed, the wrapped KellyAdjuster keeps the
 * AGGRESSIVE multiplier table; if failed, it flips to the SAFE table.
 *
 * The `polyarb_50x_validation_checkpoints` table is the durable record;
 * in-memory `dayTenValidationPassed` on the adjuster is the live gate.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeMetrics, SessionMetrics } from './realtime-metrics.js';

export interface Day10Decision {
  validation_passed: boolean;
  decision: 'MAINTAIN_2_5x' | 'REVERT_TO_2_0x';
  recommendation: string;
  metrics: SessionMetrics;
  failures: string[];
  warnings: string[];
}

export interface KellyAdjusterDay10Hook {
  agentId: string;
  deploymentDate: Date;
  setDayTenValidationPassed(passed: boolean): void;
  daysRunning(now?: Date): number;
}

export const DAY10_THRESHOLDS = {
  minWinRate:        0.85,
  minExpectedValue:  0.025,
  minProfitFactor:   2.0,
  minSharpe:         1.2, // warning only
  minSampleSize:     20,
} as const;

export class Day10Validator {
  private inFlight = false;

  constructor(
    private readonly adjuster: KellyAdjusterDay10Hook,
    private readonly metrics: RealtimeMetrics,
  ) {}

  /**
   * True if `now` is in the [day10, day11) window AND UTC hour ∈ [18, 21).
   */
  isInWindow(now: Date = new Date()): boolean {
    const days = this.adjuster.daysRunning(now);
    if (days < 10 || days >= 11) return false;
    const h = now.getUTCHours();
    return h >= 18 && h < 21;
  }

  async alreadyExecuted(supabase: SupabaseClient): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('polyarb_50x_validation_checkpoints')
        .select('id')
        .eq('agent_id', this.adjuster.agentId)
        .eq('checkpoint_day', 10)
        .limit(1);
      if (error) {
        console.warn(`[500x] WARN day-10 checkpoint lookup failed: ${error.message}`);
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    } catch (err) {
      console.warn(`[500x] WARN day-10 checkpoint lookup threw: ${(err as Error).message}`);
      return false;
    }
  }

  evaluate(metrics: SessionMetrics): Day10Decision {
    const failures: string[] = [];
    const warnings: string[] = [];

    if (metrics.totalTrades < DAY10_THRESHOLDS.minSampleSize) {
      failures.push(`sample_size=${metrics.totalTrades} < ${DAY10_THRESHOLDS.minSampleSize}`);
    }
    if (metrics.winRate < DAY10_THRESHOLDS.minWinRate) {
      failures.push(`win_rate=${(metrics.winRate * 100).toFixed(1)}% < ${(DAY10_THRESHOLDS.minWinRate * 100).toFixed(0)}%`);
    }
    if (metrics.expectedValue < DAY10_THRESHOLDS.minExpectedValue) {
      failures.push(`ev=${metrics.expectedValue.toFixed(4)} < ${DAY10_THRESHOLDS.minExpectedValue}`);
    }
    if (Number.isFinite(metrics.profitFactor) && metrics.profitFactor < DAY10_THRESHOLDS.minProfitFactor) {
      failures.push(`pf=${metrics.profitFactor.toFixed(2)} < ${DAY10_THRESHOLDS.minProfitFactor}`);
    }
    if (metrics.sharpe < DAY10_THRESHOLDS.minSharpe) {
      warnings.push(`sharpe=${metrics.sharpe.toFixed(2)} < ${DAY10_THRESHOLDS.minSharpe}`);
    }

    const passed = failures.length === 0;
    const decision: Day10Decision['decision'] = passed ? 'MAINTAIN_2_5x' : 'REVERT_TO_2_0x';
    const recommendation = passed
      ? `Strategy validated on day 10 — keep AGGRESSIVE Kelly table (London+NY=2.5x).`
      : `Validation failed (${failures.join('; ')}). Flipping to SAFE Kelly table (London+NY=2.0x). Review before re-arming.`;

    return {
      validation_passed: passed,
      decision,
      recommendation,
      metrics,
      failures,
      warnings,
    };
  }

  /**
   * Idempotent: no-op outside the window or after first execution. On
   * first execution within the window, evaluates, mutates the adjuster's
   * gate flag, and persists the checkpoint row.
   */
  async validateAndExecute(
    supabase: SupabaseClient,
    now: Date = new Date(),
  ): Promise<Day10Decision | null> {
    if (this.inFlight) return null;
    if (!this.isInWindow(now)) return null;
    if (await this.alreadyExecuted(supabase)) return null;

    this.inFlight = true;
    try {
      const metrics = this.metrics.getSessionMetrics();
      const result = this.evaluate(metrics);

      this.adjuster.setDayTenValidationPassed(result.validation_passed);

      console.log('[500x] === DAY-10 VALIDATION ===');
      console.log(`[500x] decision=${result.decision} passed=${result.validation_passed}`);
      console.log(`[500x] metrics: trades=${metrics.totalTrades} wr=${(metrics.winRate * 100).toFixed(1)}% ev=${metrics.expectedValue.toFixed(4)} pf=${Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : '∞'} sharpe=${metrics.sharpe.toFixed(2)}`);
      if (result.failures.length) console.log(`[500x] failures: ${result.failures.join(' | ')}`);
      if (result.warnings.length) console.log(`[500x] warnings: ${result.warnings.join(' | ')}`);
      console.log(`[500x] ${result.recommendation}`);

      try {
        const { error } = await supabase
          .from('polyarb_50x_validation_checkpoints')
          .insert({
            agent_id: this.adjuster.agentId,
            checkpoint_day: 10,
            validation_passed: result.validation_passed,
            decision: result.decision,
            metrics_json: metrics,
            recommendation: result.recommendation,
          });
        if (error) {
          console.warn(`[500x] WARN failed to persist checkpoint: ${error.message}`);
        }
      } catch (err) {
        console.warn(`[500x] WARN checkpoint insert threw: ${(err as Error).message}`);
      }

      return result;
    } finally {
      this.inFlight = false;
    }
  }
}
