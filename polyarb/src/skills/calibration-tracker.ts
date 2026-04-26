/**
 * E1 — Outcome Calibration Tracker
 *
 * Tracks whether Polymarket systematically over/under-estimates probabilities
 * in BTC/ETH 5-min binary markets.
 *
 * Example: if the bot enters YES trades at an average of 52% market price,
 * and they win only 47% of the time, Polymarket is overpriced in that range.
 * Correction: subtract 0.05 from fairPrice before edge calculation.
 *
 * Stores calibration data in both Supabase (persistent) and memory (fast).
 */

import { getSupabase } from '../supabase.js';

type ProbBucket = '0-20' | '20-40' | '40-60' | '60-80' | '80-100';

function getBucket(prob: number): ProbBucket {
  if (prob < 0.20) return '0-20';
  if (prob < 0.40) return '20-40';
  if (prob < 0.60) return '40-60';
  if (prob < 0.80) return '60-80';
  return '80-100';
}

function bucketMidpoint(bucket: ProbBucket): number {
  const map: Record<ProbBucket, number> = {
    '0-20': 0.10, '20-40': 0.30, '40-60': 0.50, '60-80': 0.70, '80-100': 0.90,
  };
  return map[bucket];
}

export interface CalibrationSignal {
  biasCorrection: number;    // -0.05 to +0.05 — added to fairPrice
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  observedWinRate: number;
  expectedWinRate: number;
  sampleCount: number;
}

interface BucketStats {
  wins: number;
  total: number;
}

export class CalibrationTracker {
  private inMemory: Map<string, BucketStats> = new Map(); // key = agentId:symbol:bucket
  private agentId: string;
  private userId: string;
  private lastPersistAt = 0;
  private readonly PERSIST_INTERVAL = 10 * 60_000; // persist every 10 min

  constructor(agentId: string, userId: string) {
    this.agentId = agentId;
    this.userId  = userId;
  }

  async loadFromDb(): Promise<void> {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('polyarb_calibration_data')
        .select('symbol, prob_bucket, wins, total')
        .eq('agent_id', this.agentId);

      if (!data) return;
      for (const row of data) {
        const key = `${this.agentId}:${row.symbol}:${row.prob_bucket}`;
        this.inMemory.set(key, { wins: row.wins, total: row.total });
      }
    } catch {
      // Non-critical
    }
  }

  /** Record a closed position outcome. */
  async record(symbol: string, entryPrice: number, won: boolean): Promise<void> {
    const bucket = getBucket(entryPrice);
    const key = `${this.agentId}:${symbol}:${bucket}`;

    const existing = this.inMemory.get(key) ?? { wins: 0, total: 0 };
    existing.total += 1;
    if (won) existing.wins += 1;
    this.inMemory.set(key, existing);

    // Persist to Supabase periodically
    if (Date.now() - this.lastPersistAt > this.PERSIST_INTERVAL) {
      void this.persistToDb();
    }
  }

  /** Get bias correction for a given entry price and symbol. */
  getSignal(symbol: string, entryPrice: number): CalibrationSignal {
    const bucket = getBucket(entryPrice);
    const key = `${this.agentId}:${symbol}:${bucket}`;
    const stats = this.inMemory.get(key);

    if (!stats || stats.total < 5) {
      return { biasCorrection: 0, confidence: 'LOW', observedWinRate: 0.5, expectedWinRate: bucketMidpoint(bucket), sampleCount: stats?.total ?? 0 };
    }

    const observedWinRate = stats.wins / stats.total;
    const expectedWinRate = bucketMidpoint(bucket);
    const bias = observedWinRate - expectedWinRate;
    // Bias correction: clamp to [-0.05, +0.05]
    const biasCorrection = Math.max(-0.05, Math.min(0.05, bias));

    const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
      stats.total >= 20 ? 'HIGH' : stats.total >= 5 ? 'MEDIUM' : 'LOW';

    return {
      biasCorrection,
      confidence,
      observedWinRate,
      expectedWinRate,
      sampleCount: stats.total,
    };
  }

  private async persistToDb(): Promise<void> {
    this.lastPersistAt = Date.now();
    try {
      const supabase = getSupabase();
      const upserts: Array<{
        agent_id: string; user_id: string; symbol: string;
        prob_bucket: string; wins: number; total: number; updated_at: string;
      }> = [];

      for (const [key, stats] of this.inMemory.entries()) {
        const [, symbol, prob_bucket] = key.split(':');
        upserts.push({
          agent_id: this.agentId,
          user_id: this.userId,
          symbol: symbol ?? '',
          prob_bucket: prob_bucket ?? '40-60',
          wins: stats.wins,
          total: stats.total,
          updated_at: new Date().toISOString(),
        });
      }

      if (upserts.length === 0) return;
      await supabase
        .from('polyarb_calibration_data')
        .upsert(upserts, { onConflict: 'agent_id,symbol,prob_bucket' });
    } catch {
      // Non-critical
    }
  }
}
