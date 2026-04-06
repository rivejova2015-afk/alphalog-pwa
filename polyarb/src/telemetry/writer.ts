/**
 * Telemetry Writer — batched upsert to polyarb_telemetry every 5s.
 * Also writes equity snapshots for the chart (every 60s).
 */

import { getSupabase } from '../supabase.js';

export interface TelemetrySnapshot {
  agentId: string;
  userId: string;
  equityUsd: number;
  availableBalanceUsd: number;
  openPositionsCount: number;
  totalPnlUsd: number;
  winRate: number | null;
  profitFactor: number | null;
  sharpeRatio: number | null;
  maxDrawdownPct: number | null;
  loopLatencyMs: number;
  wsBinanceConnected: boolean;
  wsPolymarketConnected: boolean;
  btcSpotPrice: number | null;
  consecutiveWins: number;
  consecutiveLosses: number;
  lastSignal: Record<string, unknown> | null;
  errorCount1h: number;
}

const UPSERT_INTERVAL_MS = 5_000;
const EQUITY_SNAPSHOT_INTERVAL_MS = 60_000;

export class TelemetryWriter {
  private timer: ReturnType<typeof setInterval> | null = null;
  private equityTimer: ReturnType<typeof setInterval> | null = null;
  private latest: TelemetrySnapshot | null = null;

  /**
   * Update the in-memory snapshot (called from main loop).
   */
  update(snapshot: TelemetrySnapshot): void {
    this.latest = snapshot;
  }

  /**
   * Start the periodic flush timers.
   */
  start(): void {
    // Upsert telemetry every 5s
    this.timer = setInterval(() => {
      void this.flush();
    }, UPSERT_INTERVAL_MS);

    // Write equity snapshot every 60s
    this.equityTimer = setInterval(() => {
      void this.writeEquitySnapshot();
    }, EQUITY_SNAPSHOT_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.equityTimer) { clearInterval(this.equityTimer); this.equityTimer = null; }
    // Final flush
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.latest) return;

    const supabase = getSupabase();
    const s = this.latest;

    const { error } = await supabase
      .from('polyarb_telemetry')
      .upsert(
        {
          user_id: s.userId,
          agent_id: s.agentId,
          equity_usd: s.equityUsd,
          available_balance_usd: s.availableBalanceUsd,
          open_positions_count: s.openPositionsCount,
          total_pnl_usd: s.totalPnlUsd,
          win_rate: s.winRate,
          profit_factor: s.profitFactor,
          sharpe_ratio: s.sharpeRatio,
          max_drawdown_pct: s.maxDrawdownPct,
          loop_latency_ms: s.loopLatencyMs,
          ws_binance_connected: s.wsBinanceConnected,
          ws_polymarket_connected: s.wsPolymarketConnected,
          btc_spot_price: s.btcSpotPrice,
          consecutive_wins: s.consecutiveWins,
          consecutive_losses: s.consecutiveLosses,
          last_signal: s.lastSignal,
          error_count_1h: s.errorCount1h,
          last_heartbeat_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id' }
      );

    if (error) {
      console.error('[telemetry] Upsert error:', error.message);
    }

    // Also update agent heartbeat
    await supabase
      .from('polyarb_agents')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', s.agentId);
  }

  private async writeEquitySnapshot(): Promise<void> {
    if (!this.latest) return;

    const supabase = getSupabase();
    const s = this.latest;

    const { error } = await supabase
      .from('polyarb_equity_snapshots')
      .insert({
        user_id: s.userId,
        agent_id: s.agentId,
        equity_usd: s.equityUsd,
        pnl_usd: s.totalPnlUsd,
        open_positions: s.openPositionsCount,
        btc_price: s.btcSpotPrice,
      });

    if (error) {
      console.error('[telemetry] Equity snapshot error:', error.message);
    }
  }
}
