/**
 * Telemetry Writer — batched upsert to coinarb_telemetry every 5s.
 * Also writes equity snapshots for the chart (every 60s).
 */

import { getSupabase } from '../supabase.js';
import type { VelocitySignal } from '../skills/velocity-detector.js';
import type { RegimeState } from '../skills/regime-detector.js';
import type { AdaptiveState } from '../skills/adaptive-kelly.js';
import type { CrossMarketSignal } from '../skills/cross-market.js';
import type { SentimentPulse } from '../skills/sentiment-pulse.js';
import type { EventState } from '../skills/event-detector.js';

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
  // ── Superpowers ──────────────────────────────────────────────────
  /** SP#1 Velocity Detector — one signal per tracked Polymarket market */
  velocitySnapshot: VelocitySignal[] | null;
  /** SP#5 Regime Detector — current market regime */
  regimeSnapshot: RegimeState | null;
  /** SP#3 Adaptive Kelly — current threshold state */
  adaptiveKellyState: AdaptiveState | null;
  /** SP#6 Cross-Market Confirmation */
  crossMarketSnapshot: CrossMarketSignal | null;
  /** SP#4 Sentiment Pulse — anomaly scores per market */
  sentimentSnapshot: SentimentPulse[] | null;
  /** SP#2 Memory Bank — conditional win rate stats */
  memoryBankStats: Array<{ key: string; wins: number; total: number; winRate: number }> | null;
  /** Event-driven mode — last EventDetector output */
  eventState: EventState | null;
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
      .from('coinarb_telemetry')
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
          velocity_snapshot: s.velocitySnapshot ?? null,
          regime_snapshot: s.regimeSnapshot ?? null,
          adaptive_kelly_state: s.adaptiveKellyState ?? null,
          cross_market_snapshot: s.crossMarketSnapshot ?? null,
          sentiment_snapshot: s.sentimentSnapshot ?? null,
          memory_bank_stats: s.memoryBankStats ?? null,
          event_state: s.eventState ?? null,
          last_heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id' }
      );

    if (error) {
      console.error('[telemetry] Upsert error:', error.message);
    }

    // Also update agent heartbeat
    await supabase
      .from('coinarb_agents')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', s.agentId);
  }

  private async writeEquitySnapshot(): Promise<void> {
    if (!this.latest) return;

    const supabase = getSupabase();
    const s = this.latest;

    const { error } = await supabase
      .from('coinarb_equity_snapshots')
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
