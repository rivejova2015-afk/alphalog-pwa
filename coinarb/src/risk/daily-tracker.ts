/**
 * Daily stats tracker — upserts coinarb_daily_stats rows per UTC day per agent.
 *
 * The dashboard's pnl-by-day chart reads this table. Every closed trade and
 * every circuit-breaker trip flushes here. Uses UNIQUE (agent_id, day_utc) so
 * the same row keeps getting updated through the day.
 */

import { COINARB_AGENT_ID, COINARB_USER_ID } from '../core/config.js';
import { getSupabase } from '../supabase.js';

export interface DailySnapshot {
  totalTrades: number;
  wins: number;
  losses: number;
  pnlUsd: number;
  bestTradeUsd: number | null;
  worstTradeUsd: number | null;
  capitalStart: number | null;
  capitalEnd: number;
  phaseStart: string | null;
  phaseEnd: string | null;
  consecutiveLossMax: number;
  consecutiveLossCurrent: number;
  fearGreedSum: number;
  fearGreedSamples: number;
  circuitTriggered: boolean;
  equityFloorAlerted: boolean;
}

export class DailyTracker {
  private readonly DAILY_CAP_PER_SYMBOL = 33;
  private readonly DAILY_CAP_TOTAL = 100;
  private dayUtc: string = todayUtc();
  private snap: DailySnapshot = blank();
  private tradeTimestamps: number[] = [];
  private tradeCountBySymbol: Map<string, number> = new Map();

  hydrate(s: Partial<DailySnapshot>): void {
    this.snap = { ...blank(), ...s };
  }

  setOpeningCapital(capital: number, phase: string): void {
    if (this.snap.capitalStart === null) {
      this.snap.capitalStart = capital;
      this.snap.phaseStart = phase;
    }
  }

  rolloverIfNeeded(): boolean {
    const today = todayUtc();
    if (today !== this.dayUtc) {
      this.dayUtc = today;
      this.snap = blank();
      this.tradeCountBySymbol.clear();
      return true;
    }
    return false;
  }

  isSymbolCapReached(symbol: string): boolean {
    return (this.tradeCountBySymbol.get(symbol) ?? 0) >= this.DAILY_CAP_PER_SYMBOL;
  }

  isTotalCapReached(): boolean {
    return this.snap.totalTrades >= this.DAILY_CAP_TOTAL;
  }

  getCountBySymbol(symbol: string): number {
    return this.tradeCountBySymbol.get(symbol) ?? 0;
  }

  getAllCountsBySymbol(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [sym, n] of this.tradeCountBySymbol) out[sym] = n;
    return out;
  }

  recordTrade(symbol: string, pnlUsd: number, capitalAfter: number, phaseAfter: string): void {
    this.rolloverIfNeeded();
    this.snap.totalTrades += 1;
    this.tradeCountBySymbol.set(symbol, (this.tradeCountBySymbol.get(symbol) ?? 0) + 1);
    if (pnlUsd > 0) {
      this.snap.wins += 1;
      this.snap.consecutiveLossCurrent = 0;
    } else {
      this.snap.losses += 1;
      this.snap.consecutiveLossCurrent += 1;
      if (this.snap.consecutiveLossCurrent > this.snap.consecutiveLossMax) {
        this.snap.consecutiveLossMax = this.snap.consecutiveLossCurrent;
      }
    }
    this.snap.pnlUsd += pnlUsd;
    if (this.snap.bestTradeUsd === null || pnlUsd > this.snap.bestTradeUsd) this.snap.bestTradeUsd = pnlUsd;
    if (this.snap.worstTradeUsd === null || pnlUsd < this.snap.worstTradeUsd) this.snap.worstTradeUsd = pnlUsd;
    this.snap.capitalEnd = capitalAfter;
    this.snap.phaseEnd = phaseAfter;
    this.tradeTimestamps.push(Date.now());
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.tradeTimestamps = this.tradeTimestamps.filter(ts => ts > cutoff);
  }

  getPaceLastTwoHours(): number {
    const twoHAgo = Date.now() - 2 * 60 * 60 * 1000;
    return this.tradeTimestamps.filter(ts => ts > twoHAgo).length;
  }

  recordFearGreed(value: number): void {
    this.snap.fearGreedSum += value;
    this.snap.fearGreedSamples += 1;
  }

  markCircuitTriggered(): void {
    this.snap.circuitTriggered = true;
  }

  markEquityFloorAlerted(): void {
    this.snap.equityFloorAlerted = true;
  }

  get current(): { day: string; data: DailySnapshot } {
    return { day: this.dayUtc, data: { ...this.snap } };
  }

  async flush(): Promise<void> {
    if (!COINARB_USER_ID) return;
    try {
      const supabase = getSupabase();
      const winRate = this.snap.totalTrades > 0 ? this.snap.wins / this.snap.totalTrades : null;
      const fgAvg = this.snap.fearGreedSamples > 0 ? this.snap.fearGreedSum / this.snap.fearGreedSamples : null;
      await supabase.from('coinarb_daily_stats').upsert(
        {
          user_id: COINARB_USER_ID,
          agent_id: COINARB_AGENT_ID,
          strategy_id: 'A',
          day_utc: this.dayUtc,
          total_trades: this.snap.totalTrades,
          wins: this.snap.wins,
          losses: this.snap.losses,
          win_rate: winRate,
          total_pnl_usd: this.snap.pnlUsd,
          best_trade_usd: this.snap.bestTradeUsd,
          worst_trade_usd: this.snap.worstTradeUsd,
          capital_start_usd: this.snap.capitalStart,
          capital_end_usd: this.snap.capitalEnd,
          phase_start: this.snap.phaseStart,
          phase_end: this.snap.phaseEnd,
          circuit_breaker_triggered: this.snap.circuitTriggered,
          consecutive_loss_max: this.snap.consecutiveLossMax,
          fear_greed_avg: fgAvg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id,strategy_id,day_utc' },
      );
    } catch (err) {
      console.error('[daily-tracker] flush failed:', err);
    }
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function blank(): DailySnapshot {
  return {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    pnlUsd: 0,
    bestTradeUsd: null,
    worstTradeUsd: null,
    capitalStart: null,
    capitalEnd: 0,
    phaseStart: null,
    phaseEnd: null,
    consecutiveLossMax: 0,
    consecutiveLossCurrent: 0,
    fearGreedSum: 0,
    fearGreedSamples: 0,
    circuitTriggered: false,
    equityFloorAlerted: false,
  };
}
