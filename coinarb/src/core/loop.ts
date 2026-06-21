/**
 * CoinarbCoordinator — singleton per process. Owns the shared runtime (feeds,
 * paper broker, phase manager, live orders, historical candle cache) and
 * dispatches each tick to the right runner for the current market regime
 * (Phase 2 of the regime-aware restructure).
 *
 * Four runners instantiated at boot:
 *   'A' — SMC strict (StrategyRunner mode='smc')
 *   'B' — SMC aggressive (StrategyRunner mode='aggressive')
 *   'M' — Mean-reversion (MeanRevRunner)
 *   'P' — Momentum-breakout (MomentumRunner)
 *
 * Each tick re-classifies the regime via `classifyRegime` (cached 5min) and
 * dispatches via `dispatchTargetFor`:
 *   TRENDING_HIGH → B    TRENDING_LOW → P    RANGE_HIGH → A
 *   RANGE_LOW → M        DEAD → pause (skip every symbol)
 *
 * The old `CoinarbLoop` name is re-exported as an alias so `index.ts`, tests,
 * and any external consumer keep compiling without changes.
 *
 * Per-tick pipeline:
 *   1. ensureHistoricalCandles + roll over each runner's daily tracker
 *   2. manageOpenPositions for every runner (TP/SL hits)
 *   3. classifyRegime + persist to telemetry.payload.regime
 *   4. Circuit-breaker check on dispatched runner; if tripped, log BREAKER
 *   5. evaluateSymbol for each symbol in parallel on the dispatched runner
 *   6. maybeRefreshLiquidity (5min cadence)
 *   7. flushTelemetry: one upsert per runner; mirror to coinarb_agents once
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
import { MeanRevRunner, MomentumRunner, type RegimeRunner } from './regime-runners.js';
import { classifyRegime, type Regime, type RegimeResult } from '../analysis/regime-detector.js';
import { dispatchTargetFor } from './regime-dispatcher.js';

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
  private readonly runners: Map<StrategyId, RegimeRunner>;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private liquidityRefreshAt = 0;
  private historicalCandles: Map<string, Map<Timeframe, Candle[]>> = new Map();
  private historicalLoadedAt = 0;
  private historicalReloading = false;
  private readonly HIST_TTL_MS = 4 * 60 * 60 * 1000;
  private lastSyncedStatus: 'live' | 'paused' | null = null;
  // Regime cache: classifyRegime is O(N) over baseline candles, no need to
  // recompute every 15s tick — refresh every 5 min and keep the hint for
  // hysteresis on the next read.
  private cachedRegime: RegimeResult | null = null;
  private regimeCachedAt = 0;
  private readonly REGIME_CACHE_MS = 5 * 60_000;
  // Reference symbol for regime classification — BTC sets the tone for the
  // crypto majors we trade. Per-symbol regimes are a future refinement.
  private readonly REGIME_SYMBOL: Symbol = 'BTC-USD';
  // Last classified regime, persisted to telemetry.payload.regime so the
  // /intelligence/algorithms UI pill (Phase 7) can render it without an
  // extra round-trip to recompute.
  private lastRegime: Regime | null = null;

  constructor(deps: LoopDeps) {
    this.coinbase = deps.coinbase;
    this.binance = deps.binance;
    this.liveOrders = deps.liveOrders ?? null;
    this.paperBroker = new PaperSpotBroker(STARTING_CAPITAL);
    this.phaseManager = new PhaseManager(STARTING_CAPITAL);
    // Phase 2 — four runners share the capital pool, paper broker, phase
    // manager and historical candle cache. Each owns a private circuit
    // breaker and daily tracker. Insertion order (A → B → M → P) is the
    // deterministic priority order used by the symbol mutex when more than
    // one runner could fire on the same regime in a future Phase.
    this.runners = new Map();
    this.runners.set('A', new StrategyRunner({ id: 'A', mode: 'smc' }));
    this.runners.set('B', new StrategyRunner({ id: 'B', mode: 'aggressive' }));
    this.runners.set('M', new MeanRevRunner());
    this.runners.set('P', new MomentumRunner());
  }

  /**
   * Classify the regime from the 1H candle stream of the reference symbol,
   * caching the result for `REGIME_CACHE_MS`. Returns null when there isn't
   * enough warmup data yet.
   */
  private getCurrentRegime(now: number): RegimeResult | null {
    if (this.cachedRegime && now - this.regimeCachedAt < this.REGIME_CACHE_MS) {
      return this.cachedRegime;
    }
    const tfs = this.historicalCandles.get(this.REGIME_SYMBOL);
    const candles1H = tfs?.get('1H') ?? [];
    // classifyRegime returns DEAD with confidence=0 when warmup is short;
    // we cache that too so we don't recompute the same NaN every tick.
    const previous: Regime | undefined = this.cachedRegime?.regime;
    const result = classifyRegime(candles1H, undefined, previous);
    this.cachedRegime = result;
    this.regimeCachedAt = now;
    return result;
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
      getGlobalDailyEntryCount: () => {
        let total = 0;
        for (const runner of this.runners.values()) {
          total += runner.dailyTracker.current.data.totalTrades;
        }
        return total;
      },
      getGlobalDailyEntryCountBySymbol: (symbol) => {
        let total = 0;
        for (const runner of this.runners.values()) {
          total += runner.dailyTracker.getCountBySymbol(symbol);
        }
        return total;
      },
      isSymbolLockedByOtherStrategy: async (symbol, byStrategy) => {
        // Permissive on infra blip: if the lookup throws we let the trade
        // through. Better a rare duplicate symbol than blocking trades when
        // Supabase wobbles for 5s.
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from('coinarb_positions')
            .select('strategy_id')
            .eq('agent_id', COINARB_AGENT_ID)
            .eq('symbol', symbol)
            .eq('status', 'OPEN')
            .neq('strategy_id', byStrategy)
            .limit(1);
          if (error) {
            console.warn(`[loop] mutex check error for ${symbol}:`, error.message);
            return false;
          }
          return (data?.length ?? 0) > 0;
        } catch (err) {
          console.warn(`[loop] mutex check threw for ${symbol}:`, err);
          return false;
        }
      },
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

      // Phase 2 — classify the regime and dispatch to the matching runner.
      // DEAD pauses entries (we still log the SKIP for analytics + still flush
      // telemetry in the finally block so dashboards stay fresh).
      const regimeResult = this.getCurrentRegime(tickStart);
      const regime: Regime = regimeResult?.regime ?? 'DEAD';
      const target = dispatchTargetFor(regime);
      console.log(
        `[loop] regime=${regime} (conf=${(regimeResult?.confidence ?? 0).toFixed(2)}, ` +
        `atrNorm=${(regimeResult?.atrNorm ?? 0).toFixed(2)}, adx=${(regimeResult?.adx ?? 0).toFixed(1)}) ` +
        `→ ${target}`,
      );

      if (target === 'pause') {
        for (const symbol of SYMBOLS) {
          await this.decisions.log({
            agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: 'A',
            kind: 'SKIP', symbol, venue: 'spot',
            reason: `regime=${regime} → pause (no actionable market)`,
            meta: { regime, reason: regimeResult?.reason },
          });
        }
      } else {
        const runner = this.runners.get(target);
        if (!runner) {
          console.error(`[loop] dispatch target ${target} not found in runners map`);
        } else {
          const circuitDecision = runner.circuitBreaker.canTrade(tickStart);
          if (!circuitDecision.allow) {
            await runner.logCircuitTrip(ctx, circuitDecision.reason);
          } else {
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
        }
      }

      // Stash regime on the instance so flushTelemetry can persist it in the
      // payload without re-classifying. Persisting NULL during warmup keeps
      // the UI honest about whether the detector has run yet.
      this.lastRegime = regimeResult?.regime ?? null;

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
            regime: this.lastRegime,
          },
          // Phase 5 column — same value as payload.regime, kept in a dedicated
          // column too so analytics queries can `WHERE regime = ...` without
          // jsonb extraction.
          regime: this.lastRegime,
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
