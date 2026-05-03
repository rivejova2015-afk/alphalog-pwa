/**
 * E2 — Replay Similarity Engine
 *
 * Before entering a trade, search the last 200 memory entries for situations
 * that are "similar" to the current one. Apply Bayesian win rate estimation
 * on those similar situations specifically.
 *
 * "Similar" = same symbol + same regime + huntStrength within ±20 + same session (UTC ±2h)
 *
 * This is more targeted than the general Bayesian estimator (C4) which uses
 * the full key including distanceZone and alignment. Replay focuses on
 * the conditions that matter most in practice.
 */

import { getSupabase } from '../supabase.js';
import type { MarketRegime } from './regime-detector.js';

export interface ReplaySignal {
  sampleCount: number;
  wins: number;
  losses: number;
  winRate: number;          // Bayesian posterior mean
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  voteConfidence: number;   // 0-1 for engine vote
}

const BULLISH_THRESHOLD = 0.62;
const BEARISH_THRESHOLD = 0.38;
const ALPHA0 = 2;
const BETA0  = 2;

function posteriorMean(wins: number, total: number): number {
  return (ALPHA0 + wins) / (ALPHA0 + BETA0 + total);
}

export class ReplaySimilarity {
  private agentId: string;
  private cache: Map<string, { signal: ReplaySignal; loadedAt: number }> = new Map();
  private readonly TTL_MS = 5 * 60_000;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  async getSignal(
    symbol: string,
    regime: MarketRegime,
    huntStrength: number,
    utcHour: number,
  ): Promise<ReplaySignal> {
    const cacheKey = `${symbol}:${regime}:${Math.round(huntStrength / 10) * 10}:${utcHour}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.loadedAt < this.TTL_MS) {
      return cached.signal;
    }

    const signal = await this.load(symbol, regime, huntStrength, utcHour);
    this.cache.set(cacheKey, { signal, loadedAt: Date.now() });
    return signal;
  }

  private async load(
    symbol: string,
    regime: MarketRegime,
    huntStrength: number,
    utcHour: number,
  ): Promise<ReplaySignal> {
    const neutral: ReplaySignal = {
      sampleCount: 0, wins: 0, losses: 0, winRate: 0.5,
      confidence: 'LOW', signal: 'NEUTRAL', voteConfidence: 0,
    };

    try {
      const supabase = getSupabase();

      // Fetch last 200 memory entries for symbol+regime
      const { data } = await supabase
        .from('coinarb_signal_memory')
        .select('hunt_bucket, outcome, entered_at')
        .eq('agent_id', this.agentId)
        .eq('symbol', symbol)
        .eq('regime', regime)
        .not('outcome', 'is', null)
        .order('entered_at', { ascending: false })
        .limit(200);

      if (!data || data.length === 0) return neutral;

      // Filter by similar huntStrength bucket (±1 bucket)
      const targetBucket = huntStrength >= 60 ? 'STRONG' : huntStrength >= 30 ? 'MID' : 'WEAK';
      const neighborBuckets = new Set<string>([targetBucket]);
      if (targetBucket === 'STRONG') neighborBuckets.add('MID');
      if (targetBucket === 'MID') { neighborBuckets.add('STRONG'); neighborBuckets.add('WEAK'); }
      if (targetBucket === 'WEAK') neighborBuckets.add('MID');

      // Filter by session (UTC ±2h)
      const sessionMatches = data.filter(r => {
        if (!neighborBuckets.has(r.hunt_bucket)) return false;
        if (!r.entered_at) return true;
        const h = new Date(r.entered_at).getUTCHours();
        const diff = Math.abs(h - utcHour);
        return diff <= 2 || diff >= 22; // handles midnight wrap
      });

      const wins   = sessionMatches.filter(r => r.outcome === 'WIN').length;
      const total  = sessionMatches.length;
      const losses = total - wins;

      if (total < 2) return neutral;

      const winRate = posteriorMean(wins, total);
      const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
        total >= 10 ? 'HIGH' : total >= 3 ? 'MEDIUM' : 'LOW';

      let signal_: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      let voteConfidence = 0;

      if (winRate > BULLISH_THRESHOLD && total >= 2) {
        signal_ = 'BULLISH';
        voteConfidence = Math.min(1, (winRate - 0.5) * 2);
        if (confidence === 'LOW') voteConfidence *= 0.5;
      } else if (winRate < BEARISH_THRESHOLD && total >= 2) {
        signal_ = 'BEARISH';
        voteConfidence = Math.min(1, (0.5 - winRate) * 2);
        if (confidence === 'LOW') voteConfidence *= 0.5;
      }

      return { sampleCount: total, wins, losses, winRate, confidence, signal: signal_, voteConfidence };
    } catch {
      return neutral;
    }
  }
}
