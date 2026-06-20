/**
 * CoinarbCoordinator — singleton per process. Owns the shared runtime (feeds,
 * paper broker, phase manager, live orders, historical candle cache) and
 * dispatches each tick to one or more StrategyRunner instances.
 *
 * Fase 2 instantiates a single runner ('A', mode='smc') so production behavior
 * is identical to the pre-refactor monolithic loop. Fase 3 will add the second
 * runner ('B', mode='aggressive') along with the symbol mutex and the global
 * 100/day cap shared across runners.
 *
 * The old `CoinarbLoop` name is re-exported as an alias so `index.ts`, tests,
 * and any external consumer keep compiling without changes.
 *
 * Per-tick pipeline (per runner):
 *   1. Roll over the daily tracker; record opening capital from the shared pool.
 *   2. manageOpenPositions — close TP/SL hits for positions this runner owns.
 *   3. Circuit-breaker check; if tripped, log BREAKER and skip evaluation.
 *   4. evaluateSymbol for each symbol in parallel (Promise.allSettled).
 * Then once per tick:
 *   5. Maybe refresh liquidity map (5min cadence).
 *   6. flushTelemetry: one upsert per runner; mirror to coinarb_agents once.
 */

import { CoinbaseFeed } from '../feeds/coinbase-ws.js';
import { BinanceFeed } from '../feeds/binance-ws.js';
import { CoinbaseSpotOrders } from '../trading/coinbase-spot-orders.js';
import { type CdpCredentials } from '../trading/coinbase-cdp-auth.js';
import { PaperSpotBroker } from '../paper/paper-spot-broker.js';
import { PhaseManager } from '../risk/phase-manager.js';
import { getOpenPositions, type StrategyId } from '../trading/spot-positions.js';
import { loadHistoricalCandles, type Candle } from '../analysis/candle-builder.js';
import { refreshLiquidityMap } from '../analysis/liquidity-map.js';
import { checkFearGreed } from '../validators/fear-greed.js';
import { DecisionLogger } from '../ops/decision-logger.js';
import { CommandPoller } from '../ops/command-poller.js';
import { syncAgentHeartbeat } from '../ops/agent-heartbeat.js';
import { getSupabase } from '../supabase.js';
import {
  SYMBOLS, TIMEFRAMES, LOOP_INTERVAL_MS, PAPER_MODE, TRADING_PAUSED,
  COINARB_AGENT_ID, COINARB_USER_ID,
  type Symbol, type Timeframe,
} from './config.js';
import { StrategyRunner, type EvaluationContext } from './strategy-runner.js';

const STARTING_CAPITAL = Number(process.env.COINARB_STARTING_CAPITAL ?? '100');

export interface LoopDeps {
  coinbase: CoinbaseFeed;
  binance: BinanceFeed;
  liveOrders?: CoinbaseSpotOrders;
}

export class CoinarbCoordinator {
  private readonly coinbase: CoinbaseFeed;
  private readonly binance: BinanceFeed;
  private readonly liveOrders: CoinbaseSpotOrders | null;
  private readonly paperBroker: PaperSpotBroker;
  private readonly phaseManager: PhaseManager;
  private readonly decisions = new DecisionLogger();
  private readonly commandPoller = new CommandPoller();
  private readonly runners: Map<StrategyId, StrategyRunner>;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private liquidityRefreshAt = 0;
  private historicalCandles: Map<string, Map<Timeframe, Candle[]>> = new Map();
  private historicalLoadedAt = 0;
  private historicalReloading = false;
  private readonly HIST_TTL_MS = 4 * 60 * 60 * 1000;
  private lastSyncedStatus: 'live' | 'paused' | null = null;

  constructor(deps: LoopDeps) {
    this.coinbase = deps.coinbase;
    this.binance = deps.binance;
    this.liveOrders = deps.liveOrders ?? null;
    this.paperBroker = new PaperSpotBroker(STARTING_CAPITAL);
    this.phaseManager = new PhaseManager(STARTING_CAPITAL);
    // Fase 2: only Strategy A is wired in. Fase 3 appends Strategy B with
    // mode='aggressive'. The runners map already supports both today.
    this.runners = new Map();
    this.runners.set('A', new StrategyRunner({ id: 'A', mode: 'smc' }));
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.coinbase.start();
    this.binance.start();
    this.commandPoller.start();
    console.log(`[loop] started — ${PAPER_MODE ? 'PAPER' : 'LIVE'} mode, ${LOOP_INTERVAL_MS}ms tick, runners=${this.runners.size}`);
    this.timer = setInterval(() => { void this.tick(); }, LOOP_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.commandPoller.stop();
    this.coinbase.stop();
    this.binance.stop();
    console.log('[loop] stopped');
  }

  private async ensureHistoricalCandles(): Promise<void> {
    const now = Date.now();
    const fresh = this.historicalLoadedAt > 0 && now - this.historicalLoadedAt < this.HIST_TTL_MS;
    if (fresh) return;

    // Stale-data background reload. First load blocks (we need data to evaluate).
    // Subsequent stale reloads run in the background so the 15s tick isn't held
    // up by a multi-second Coinbase REST burst.
    if (this.historicalReloading) return;

    const isFirstLoad = this.historicalCandles.size === 0;
    if (isFirstLoad) {
      console.log('[loop] loading historical candles (first load — blocking)…');
      this.historicalReloading = true;
      try {
        await this.reloadHistorical();
      } finally {
        this.historicalReloading = false;
      }
      return;
    }

    this.historicalReloading = true;
    console.log('[loop] historical data stale — kicking off background reload…');
    void this.reloadHistorical()
      .catch(err => console.warn('[loop] background historical reload failed:', err))
      .finally(() => { this.historicalReloading = false; });
  }

  private async reloadHistorical(): Promise<void> {
    const start = Date.now();
    for (const symbol of SYMBOLS) {
      try {
        const hist = await loadHistoricalCandles(symbol, TIMEFRAMES);
        this.historicalCandles.set(symbol, hist);
      } catch (err) {
        console.warn(`[loop] historical load failed for ${symbol}:`, err);
      }
    }
    this.historicalLoadedAt = Date.now();
    console.log(`[loop] historical reload complete in ${Date.now() - start}ms`);
  }

  private buildEvaluationContext(fearGreed: number): EvaluationContext {
    return {
      coinbase: this.coinbase,
      binance: this.binance,
      paperBroker: this.paperBroker,
      phaseManager: this.phaseManager,
      liveOrders: this.liveOrders,
      decisions: this.decisions,
      historicalCandles: this.historicalCandles,
      fearGreed,
    };
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const tickStart = Date.now();
    // Neutral F&G default kept fresh below. Used by telemetry in finally even
    // if the tick throws mid-pipeline.
    let fgValue = 50;

    try {
      await this.ensureHistoricalCandles();

      // Per-runner state hydration: each runner has its own daily tracker and
      // they all read opening capital from the shared phase manager.
      for (const runner of this.runners.values()) {
        runner.dailyTracker.rolloverIfNeeded();
        runner.dailyTracker.setOpeningCapital(this.phaseManager.capitalNow, this.phaseManager.phaseName);
      }

      // Manage open positions for every runner. manageOpenPositions doesn't
      // touch fearGreed, so passing the neutral stub here is fine — the live
      // value is fetched right after.
      const ctxStub = this.buildEvaluationContext(fgValue);
      for (const runner of this.runners.values()) {
        await runner.manageOpenPositions(ctxStub);
      }

      // F&G is telemetry-only — never blocks entries, never accumulates into
      // daily stats. Price-action SMC handles direction; external sentiment
      // indices add no edge here.
      const fg = await checkFearGreed();
      fgValue = fg.value;
      const ctx = this.buildEvaluationContext(fgValue);

      // Per-runner circuit-breaker + parallel symbol evaluation. Runners are
      // independent: if A trips, B keeps trading. evaluateSymbol enforces its
      // own daily caps internally.
      for (const runner of this.runners.values()) {
        const circuitDecision = runner.circuitBreaker.canTrade(tickStart);
        if (!circuitDecision.allow) {
          await runner.logCircuitTrip(ctx, circuitDecision.reason);
          continue;
        }
        const evalStart = Date.now();
        const results = await Promise.allSettled(
          SYMBOLS.map(symbol => runner.evaluateSymbol(symbol, ctx)),
        );
        const evalMs = Date.now() - evalStart;
        const failed = results
          .map((r, i) => r.status === 'rejected' ? { symbol: SYMBOLS[i], reason: r.reason } : null)
          .filter((x): x is { symbol: Symbol; reason: unknown } => x !== null);
        if (failed.length > 0) {
          for (const f of failed) {
            console.error(`[loop ${runner.id}] evaluateSymbol(${f.symbol}) rejected:`, f.reason);
          }
        }
        const trades = runner.dailyTracker.current.data.totalTrades;
        const counts = runner.dailyTracker.getAllCountsBySymbol();
        const countsStr = SYMBOLS.map(s => `${s.split('-')[0]}=${counts[s] ?? 0}`).join(' ');
        console.log(`[loop ${runner.id}] eval ${evalMs}ms | trades=${trades}/100 | ${countsStr} | failed=${failed.length}`);
      }

      await this.maybeRefreshLiquidity(tickStart);
    } catch (err) {
      console.error('[loop] tick failed:', err);
    } finally {
      // Heartbeat ALWAYS — even when the tick threw mid-pipeline. Dashboard
      // staleness had masked healthy ticks because telemetry sat after the
      // throwing block instead of in finally.
      try {
        await this.flushTelemetry(fgValue);
        for (const runner of this.runners.values()) {
          await runner.dailyTracker.flush();
        }
      } catch (err) {
        console.error('[loop] telemetry flush in finally failed:', err);
      }
    }
  }

  private async maybeRefreshLiquidity(now: number): Promise<void> {
    if (now - this.liquidityRefreshAt < 5 * 60_000) return;
    this.liquidityRefreshAt = now;
    for (const symbol of SYMBOLS) {
      void refreshLiquidityMap(symbol, '1H');
    }
  }

  private async syncAlgorithmStatus(supabase: ReturnType<typeof getSupabase>, paused: boolean): Promise<void> {
    // Sync algorithms.status with the bot's actual runtime state so the UI
    // doesn't lie. Only writes when status actually flips — a passive bot
    // shouldn't churn updated_at every 15s.
    const desired: 'live' | 'paused' = paused ? 'paused' : 'live';
    if (desired === this.lastSyncedStatus) return;
    const { error } = await supabase
      .from('algorithms')
      .update({ status: desired, updated_at: new Date().toISOString() })
      .eq('id', COINARB_AGENT_ID);
    if (error) {
      console.warn(`[loop] algorithms.status sync failed:`, error.message);
      return;
    }
    this.lastSyncedStatus = desired;
    console.log(`[loop] algorithms.status -> ${desired}`);
  }

  private async flushTelemetry(fearGreed: number): Promise<void> {
    if (!COINARB_USER_ID) return;
    try {
      const supabase = getSupabase();
      const btc = this.coinbase.getPrice('BTC');

      // Overall paused flag is true if user paused OR any runner tripped OR any
      // runner hit its daily cap. The UI today renders a single algorithm-level
      // status; Fase 5 will surface per-strategy status.
      let anyPaused = TRADING_PAUSED;
      for (const runner of this.runners.values()) {
        const cb = runner.circuitBreaker.snapshot;
        if (cb.pausedUntil !== null && cb.pausedUntil > Date.now()) anyPaused = true;
        if (runner.dailyTracker.isTotalCapReached()) anyPaused = true;
      }
      await this.syncAlgorithmStatus(supabase, anyPaused);

      // Open positions count is global (across all runners) — it's a shared
      // wallet snapshot, not a per-strategy stat.
      const openPositionsCount = (await getOpenPositions().catch(() => [])).length;

      // One telemetry row per runner so /intelligence/agents and the dashboard
      // can render per-strategy stats without aggregation gymnastics. With one
      // runner today this is identical to the pre-refactor single upsert.
      for (const runner of this.runners.values()) {
        const cbState = runner.circuitBreaker.snapshot;
        const daily = runner.dailyTracker.current.data;
        const tradesBySymbol = runner.dailyTracker.getAllCountsBySymbol();
        await supabase.from('coinarb_telemetry').upsert({
          user_id: COINARB_USER_ID,
          agent_id: COINARB_AGENT_ID,
          strategy_id: runner.id,
          equity_usd: this.phaseManager.capitalNow,
          available_balance_usd: this.paperBroker.balanceUsd,
          open_positions_count: openPositionsCount,
          total_pnl_usd: daily.pnlUsd,
          win_rate: daily.totalTrades > 0 ? daily.wins / daily.totalTrades : null,
          ws_coinbase_connected: this.coinbase.isConnected,
          ws_binance_connected: this.binance.isConnected,
          ws_binance_connected_spot: this.binance.isConnected,
          btc_spot_price: btc?.last ?? null,
          consecutive_losses: cbState.consecutiveLosses,
          daily_trades_count: daily.totalTrades,
          daily_wins: daily.wins,
          daily_losses: daily.losses,
          phase_current: this.phaseManager.phaseName,
          risk_pct_current: this.phaseManager.riskPct,
          capital_current: this.phaseManager.capitalNow,
          fear_greed_index: fearGreed,
          paused_until: cbState.pausedUntil ? new Date(cbState.pausedUntil).toISOString() : null,
          last_heartbeat_at: new Date().toISOString(),
          payload: {
            trades_by_symbol: tradesBySymbol,
            total_cap: 100,
            per_symbol_cap: 33,
          },
        }, { onConflict: 'agent_id,strategy_id' });
      }
      // Mirror heartbeat to coinarb_agents (legacy table still consumed by the
      // /intelligence/agents dashboard). One write per tick — best-effort.
      const agentResult = await syncAgentHeartbeat(supabase, COINARB_USER_ID, anyPaused);
      if (!agentResult.ok && agentResult.error !== 'no user_id') {
        console.warn('[loop] coinarb_agents heartbeat sync failed:', agentResult.error);
      }
    } catch (err) {
      console.error('[loop] telemetry flush failed:', err);
    }
  }
}

// Backwards-compat alias. External consumers (index.ts, tests) keep importing
// `CoinarbLoop` and the runtime type stays identical to CoinarbCoordinator.
export { CoinarbCoordinator as CoinarbLoop };

export function buildLoop(creds?: CdpCredentials): CoinarbCoordinator {
  return new CoinarbCoordinator({
    coinbase: new CoinbaseFeed(),
    binance: new BinanceFeed(),
    liveOrders: !PAPER_MODE && creds ? new CoinbaseSpotOrders(creds) : undefined,
  });
}
