/**
 * RealtimeMetrics — in-memory snapshot of recent trade outcomes used by
 * the Day-10 validator and anomaly detector.
 *
 * Source of truth for cross-restart aggregates is `polyarb_trades`
 * scoped by `agent_id`. This object hydrates from that table at boot
 * and tracks subsequent trades in-memory between persistence flushes.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionName } from '../scheduler.js';

export interface TradeRecord {
  pnl: number;
  pnlPercent: number;
  expectedValue: number;
  session: SessionName | string;
  confidence: number;
  slippage: number;
  executionTimeMs: number;
  timestamp: number;
}

export interface SessionMetrics {
  totalTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  expectedValue: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  currentDrawdown: number;
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: number;
  avgSlippage: number;
  avgExecutionTimeMs: number;
  tradesPerMinute: number;
  alerts: string[];
  perSession: Record<string, { trades: number; winRate: number; totalPnl: number }>;
}

const EMPTY_METRICS: SessionMetrics = {
  totalTrades: 0,
  winners: 0,
  losers: 0,
  winRate: 0,
  totalPnl: 0,
  avgPnl: 0,
  expectedValue: 0,
  profitFactor: 0,
  sharpe: 0,
  sortino: 0,
  maxDrawdown: 0,
  currentDrawdown: 0,
  longestWinStreak: 0,
  longestLossStreak: 0,
  currentStreak: 0,
  avgSlippage: 0,
  avgExecutionTimeMs: 0,
  tradesPerMinute: 0,
  alerts: [],
  perSession: {},
};

export class RealtimeMetrics {
  private trades: TradeRecord[] = [];
  private bootAt = Date.now();

  recordTrade(t: TradeRecord): void {
    this.trades.push(t);
    if (this.trades.length > 5000) {
      this.trades = this.trades.slice(-5000);
    }
  }

  getRecentTrades(n = 100): TradeRecord[] {
    return this.trades.slice(-n);
  }

  size(): number {
    return this.trades.length;
  }

  getSessionMetrics(): SessionMetrics {
    if (this.trades.length === 0) return { ...EMPTY_METRICS, perSession: {} };

    const t = this.trades;
    const winners = t.filter((x) => x.pnl > 0);
    const losers  = t.filter((x) => x.pnl <= 0);

    const totalPnl = t.reduce((s, x) => s + x.pnl, 0);
    const avgPnl   = totalPnl / t.length;
    const wins     = winners.reduce((s, x) => s + x.pnl, 0);
    const losses   = Math.abs(losers.reduce((s, x) => s + x.pnl, 0));

    const winRate = winners.length / t.length;
    const avgWin  = winners.length ? wins / winners.length : 0;
    const avgLoss = losers.length  ? losses / losers.length : 0;
    const expectedValue = winRate * avgWin - (1 - winRate) * avgLoss;
    const profitFactor  = losses > 0 ? wins / losses : (wins > 0 ? Infinity : 0);

    // Sharpe / Sortino on per-trade pnlPercent
    const rets = t.map((x) => x.pnlPercent);
    const meanRet = rets.reduce((a, b) => a + b, 0) / rets.length;
    const stdRet  = Math.sqrt(
      rets.reduce((a, b) => a + (b - meanRet) ** 2, 0) / rets.length,
    );
    const negRets = rets.filter((r) => r < 0);
    const downside = negRets.length
      ? Math.sqrt(negRets.reduce((a, b) => a + b * b, 0) / negRets.length)
      : 0;
    const sharpe  = stdRet  > 0 ? meanRet / stdRet  : 0;
    const sortino = downside > 0 ? meanRet / downside : 0;

    // Drawdown on cumulative pnl curve
    let peak = 0;
    let cum = 0;
    let maxDd = 0;
    for (const x of t) {
      cum += x.pnl;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDd) maxDd = dd;
    }
    const currentDrawdown = peak - cum;

    // Streaks
    let longestWin = 0;
    let longestLoss = 0;
    let curWin = 0;
    let curLoss = 0;
    for (const x of t) {
      if (x.pnl > 0) {
        curWin += 1;
        curLoss = 0;
        longestWin = Math.max(longestWin, curWin);
      } else {
        curLoss += 1;
        curWin = 0;
        longestLoss = Math.max(longestLoss, curLoss);
      }
    }
    const currentStreak = curWin > 0 ? curWin : -curLoss;

    const avgSlippage  = t.reduce((s, x) => s + x.slippage, 0) / t.length;
    const avgExecTime  = t.reduce((s, x) => s + x.executionTimeMs, 0) / t.length;
    const minutesElapsed = Math.max(1 / 60, (Date.now() - this.bootAt) / 60_000);
    const tradesPerMinute = t.length / minutesElapsed;

    const perSession: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};
    for (const x of t) {
      const key = String(x.session);
      const bucket = perSession[key] ?? { trades: 0, winRate: 0, totalPnl: 0 };
      bucket.trades += 1;
      bucket.totalPnl += x.pnl;
      perSession[key] = bucket;
    }
    for (const key of Object.keys(perSession)) {
      const ws = t.filter((x) => String(x.session) === key && x.pnl > 0).length;
      perSession[key].winRate = perSession[key].trades > 0 ? ws / perSession[key].trades : 0;
    }

    const alerts: string[] = [];
    if (t.length >= 20 && winRate < 0.50) alerts.push(`LOW_WIN_RATE ${(winRate * 100).toFixed(1)}%`);
    if (t.length >= 20 && expectedValue < 0) alerts.push(`NEGATIVE_EV ${expectedValue.toFixed(4)}`);
    if (curLoss >= 5) alerts.push(`LOSS_STREAK_${curLoss}`);
    if (avgSlippage > 0.02) alerts.push(`HIGH_SLIPPAGE ${(avgSlippage * 100).toFixed(2)}%`);
    if (avgExecTime > 5000) alerts.push(`SLOW_EXECUTION ${avgExecTime.toFixed(0)}ms`);
    if (profitFactor < 1.0 && t.length >= 20) alerts.push(`PF_BELOW_1 ${profitFactor.toFixed(2)}`);

    return {
      totalTrades: t.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      totalPnl,
      avgPnl,
      expectedValue,
      profitFactor,
      sharpe,
      sortino,
      maxDrawdown: maxDd,
      currentDrawdown,
      longestWinStreak: longestWin,
      longestLossStreak: longestLoss,
      currentStreak,
      avgSlippage,
      avgExecutionTimeMs: avgExecTime,
      tradesPerMinute,
      alerts,
      perSession,
    };
  }

  generateAlerts(): string[] {
    return this.getSessionMetrics().alerts;
  }

  /**
   * Re-populates `trades` from `polyarb_trades` for a single agent within
   * the last `days` days. Best-effort; failures only log a warning.
   */
  async hydrateFromSupabase(
    supabase: SupabaseClient,
    agentId: string,
    days = 11,
  ): Promise<void> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
      const { data, error } = await supabase
        .from('polyarb_trades')
        .select('pnl_usd, size_usd, executed_at, slippage_bps, execution_latency_ms')
        .eq('agent_id', agentId)
        .gte('executed_at', since)
        .order('executed_at', { ascending: true })
        .limit(5000);

      if (error) {
        console.warn(`[500x] WARN realtime-metrics hydrate query failed: ${error.message}`);
        return;
      }
      if (!data || data.length === 0) return;

      const rows = data as Array<Record<string, unknown>>;
      this.trades = rows.map((r) => {
        const pnl = Number(r.pnl_usd ?? 0);
        const sizeUsd = Number(r.size_usd ?? 0);
        return {
          pnl,
          pnlPercent: sizeUsd > 0 ? pnl / sizeUsd : 0,
          expectedValue: 0,
          session: 'UNKNOWN',
          confidence: 0,
          slippage: Number(r.slippage_bps ?? 0) / 10_000,
          executionTimeMs: Number(r.execution_latency_ms ?? 0),
          timestamp: r.executed_at ? Date.parse(String(r.executed_at)) : Date.now(),
        };
      });
      console.log(`[500x] realtime-metrics hydrated ${this.trades.length} trades over ${days}d`);
    } catch (err) {
      console.warn(`[500x] WARN realtime-metrics hydrate threw: ${(err as Error).message}`);
    }
  }
}
