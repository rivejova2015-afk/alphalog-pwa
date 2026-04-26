/**
 * C4 — Bayesian Win Rate Estimator
 *
 * Replaces MemoryBank's naive frequentism with a Beta distribution.
 * Prior: Beta(2, 2) → mean = 0.5, symmetric, uninformative.
 * After n trades: Beta(2 + wins, 2 + losses) → posterior.
 *
 * Key benefit: eliminates the cold-start problem.
 *   - 0 trades → posterior = 0.50 (no signal, no block)
 *   - 2 wins / 1 loss → posterior = 0.57 (mild bullish tilt)
 *   - 15 wins / 5 losses → posterior = 0.72 (strong signal)
 *
 * Shares polyarb_memory_entries DB (same keys as MemoryBank).
 */

import { getSupabase } from '../supabase.js';
import type { MarketRegime } from './regime-detector.js';
import type { VelocitySignal } from './velocity-detector.js';

export interface BayesianEstimate {
  posteriorMean: number;   // 0-1
  posteriorStd: number;    // uncertainty measure
  sampleCount: number;
  wins: number;
  losses: number;
  priorDominates: boolean; // true if n < 5, prior heavily weighted
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;      // 0-1
}

const VOTE_BULLISH_THRESHOLD = 0.62;
const VOTE_BEARISH_THRESHOLD = 0.38;
const MIN_SAMPLES_MEDIUM     = 2;
const MIN_SAMPLES_HIGH       = 5;

// Prior hyperparameters: Beta(alpha0, beta0)
const ALPHA0 = 2;
const BETA0  = 2;

function buildConditionKey(
  symbol: string,
  regime: MarketRegime,
  distanceZone: 'CLOSE' | 'MID' | 'FAR',
  alignment: 'ALIGNED' | 'MIXED',
  huntBucket: 'WEAK' | 'MID' | 'STRONG',
): string {
  return `${symbol}:${regime}:${distanceZone}:${alignment}:${huntBucket}`;
}

function getDistanceZone(signal: VelocitySignal): 'CLOSE' | 'MID' | 'FAR' {
  const dist = signal.milestone?.distancePct ?? 15;
  if (dist < 5) return 'CLOSE';
  if (dist < 10) return 'MID';
  return 'FAR';
}

function getAlignment(signal: VelocitySignal): 'ALIGNED' | 'MIXED' {
  const w5m  = signal.windows.find(w => w.label === '5m');
  const w1h  = signal.windows.find(w => w.label === '1h');
  if (!w5m || !w1h) return 'MIXED';
  if (w5m.direction === 'FLAT' || w1h.direction === 'FLAT') return 'MIXED';
  return w5m.direction === w1h.direction ? 'ALIGNED' : 'MIXED';
}

function getHuntBucket(huntStrength: number): 'WEAK' | 'MID' | 'STRONG' {
  if (huntStrength >= 60) return 'STRONG';
  if (huntStrength >= 30) return 'MID';
  return 'WEAK';
}

export class BayesianWinRate {
  private cache: Map<string, { wins: number; total: number; loadedAt: number }> = new Map();
  private readonly TTL_MS = 5 * 60_000; // refresh from DB every 5 min

  async estimate(
    signal: VelocitySignal,
    regime: MarketRegime,
  ): Promise<BayesianEstimate> {
    const key = buildConditionKey(
      signal.symbol,
      regime,
      getDistanceZone(signal),
      getAlignment(signal),
      getHuntBucket(signal.huntStrength),
    );

    const stats = await this.loadStats(key);
    const wins   = stats?.wins ?? 0;
    const total  = stats?.total ?? 0;
    const losses = total - wins;

    // Posterior: Beta(alpha0 + wins, beta0 + losses)
    const alpha = ALPHA0 + wins;
    const beta  = BETA0  + losses;
    const N     = alpha + beta;

    const posteriorMean = alpha / N;
    const posteriorStd  = Math.sqrt((alpha * beta) / (N * N * (N + 1)));
    const priorDominates = total < MIN_SAMPLES_HIGH;

    let signal_: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0;

    const hasEnoughData = total >= MIN_SAMPLES_MEDIUM;

    if (hasEnoughData && posteriorMean > VOTE_BULLISH_THRESHOLD) {
      signal_ = 'BULLISH';
      confidence = Math.min(1, (posteriorMean - 0.5) * 2);
      // Scale down confidence when prior still dominates
      if (priorDominates) confidence *= 0.5;
    } else if (hasEnoughData && posteriorMean < VOTE_BEARISH_THRESHOLD) {
      signal_ = 'BEARISH';
      confidence = Math.min(1, (0.5 - posteriorMean) * 2);
      if (priorDominates) confidence *= 0.5;
    }

    return {
      posteriorMean,
      posteriorStd,
      sampleCount: total,
      wins,
      losses,
      priorDominates,
      signal: signal_,
      confidence,
    };
  }

  private async loadStats(key: string): Promise<{ wins: number; total: number } | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < this.TTL_MS) {
      return cached;
    }

    try {
      const supabase = getSupabase();
      const [symbol, regime, distanceZone, alignment, huntBucket] = key.split(':');

      const { data } = await supabase
        .from('polyarb_signal_memory')
        .select('outcome')
        .eq('symbol', symbol)
        .eq('regime', regime)
        .eq('distance_zone', distanceZone)
        .eq('velocity_alignment', alignment)
        .eq('hunt_bucket', huntBucket)
        .not('outcome', 'is', null);

      if (!data) return null;

      const wins  = data.filter(r => r.outcome === 'WIN').length;
      const total = data.length;

      const stats = { wins, total, loadedAt: Date.now() };
      this.cache.set(key, stats);
      return stats;
    } catch {
      return null;
    }
  }
}
