/**
 * 500x Trading Loop — strategy variant of the production loop.
 *
 * Reuses all production primitives (feeds, regime, fundamental engine,
 * event detector, position tracker, order manager, statistical CB) but
 * replaces the 14-engine consensus with the 5-layer validator + ENTER/SCALP
 * decision tier and adds three strategy-only mechanics:
 *
 *   1. Session-aware Kelly multiplier (London/NY/Overlap/Asia)
 *   2. Cascade entries (+2% favourable → add at decreasing Kelly)
 *   3. Day-10 auto-validation gate (auto-revert to SAFE multipliers if failed)
 *
 * The production engine is untouched — both processes write into the same
 * Supabase tables but with different `agent_id`s.
 */

import type { BinanceFeed } from '../../feeds/binance-ws.js';
import type { BinancePerpFeed } from '../../feeds/binance-perp-ws.js';
import type { DeribitIVFeed } from '../../feeds/deribit-iv-ws.js';
import type { PolymarketFeed, PolymarketOrderbook } from '../../feeds/polymarket-ws.js';
import type { PositionTracker, Position } from '../../trading/position-tracker.js';
import type { OrderManager } from '../../trading/order-manager.js';
import type { TelemetryWriter } from '../../telemetry/writer.js';
import { evaluateConfluence } from '../../skills/confluence-engine.js';
import {
  checkCircuitBreakers,
  drainEvents,
  rebaseStartOfDay,
  type CircuitBreakerState,
} from '../../trading/circuit-breaker.js';
import { logCircuitBreakerEvents, logCompliance } from '../../telemetry/compliance.js';
import { estimateBeliefVolatility, computeFairPrice, computeEdge } from '../../math/jump-diffusion.js';
import { hestonStep, type HestonState } from '../../math/heston-vol.js';
import { asymmetricKelly } from '../../math/asymmetric-kelly.js';

import {
  computeVelocitySignal,
  type VelocitySignal,
} from '../../skills/velocity-detector.js';
import { detectRegime, type RegimeState } from '../../skills/regime-detector.js';
import { computeReversalSignal } from '../../skills/reversal-radar.js';
import { type FundamentalEngine, compositeEdgeMultiplier } from '../../analysis/fundamental-engine.js';
import type { FundamentalSignal } from '../../analysis/types.js';
import { settleTimedOutPosition } from '../../skills/settlement-engine.js';
import { getSupabase } from '../../supabase.js';
import {
  WindowGate,
  extractWindowInfo,
  isInEntryWindow,
  isNearExpiry,
} from '../../trading/window-gate.js';
import {
  recordExit,
  runStatisticalChecks,
  type StatCBState,
} from '../../trading/statistical-circuit-breaker.js';
import {
  EventDetector,
  inactiveEventState,
  type EventState,
} from '../../skills/event-detector.js';
import { MacroEventFeed } from '../../feeds/macro-event-feed.js';
import { effectiveKellyCap } from '../../skills/dynamic-kelly-cap.js';
import { type CalibrationTracker } from '../../skills/calibration-tracker.js';

import type { FiftyXAgentConfig } from './config-50x.js';
import { validate as fiveLayerValidate } from './five-layer-validator.js';
import { decide } from './decision-tier.js';
import { adjustKelly } from './kelly-adjuster.js';
import {
  CascadeState,
  shouldCascade,
} from './cascade-manager.js';
import { TradeScheduler, type SessionInfo, type SessionName } from './scheduler.js';
import { RealtimeMetrics } from './observability/realtime-metrics.js';
import { AnomalyDetector } from './observability/anomaly-detector.js';
import { Day10Validator, type KellyAdjusterDay10Hook } from './observability/day-10-validator.js';

// ─── Engine v2 — multi-source confluence rollout ────────────────────────────
// 'off'    : legacy behaviour, no confluence gating, no sizing cap, no dryrun branch.
// 'dryrun' : confluence + midprice gates run, decisions are logged with the
//            ENGINE_V2 prefix, but placeOrder() is short-circuited.
// 'live'   : confluence gates active AND placeOrder() executes with the
//            confluence-derived sizing cap.
export type EngineV2Mode = 'off' | 'dryrun' | 'live';
export function resolveEngineV2Mode(): EngineV2Mode {
  const raw = (process.env.POLYARB_ENGINE_V2_MODE ?? 'off').toLowerCase();
  if (raw === 'dryrun' || raw === 'live') return raw;
  return 'off';
}
const ENGINE_V2_MODE: EngineV2Mode = resolveEngineV2Mode();

// ─── Engine v2 Phase 2 — per-window trade trigger optimization ──────────────
// Tiered confluence by time remaining in the 5-min window. NORMAL_MIN applies
// when msRemaining > LASTCHANCE_WINDOW_MS, LASTCHANCE_MIN when within the
// last-chance window, PANIC_MIN when within the panic window. The panic tier
// can drop sourcesAgreeing requirement to 0 (acts on velocity-detector alone)
// and uses a flat $25 cap when the confluence engine returned cap=0.
//
// FAVORED_SIDE_INVERSION lets the loop accept buyNo trades when YES_mid<=0.50
// (because NO_mid = 1-YES_mid > 0.50 — still the favored side). When disabled
// the loop falls back to the legacy behavior of skipping any market with
// midPrice<=0.50.
//
// All defaults preserve Phase 1 behavior (NORMAL=2, LASTCHANCE=2, PANIC=2,
// inversion off, max-open=2). Tuning happens via fly secrets.
const PHASE2_NORMAL_MIN_AGREE = parseInt(process.env.POLYARB_CONFLUENCE_NORMAL_MIN ?? '2', 10);
const PHASE2_LASTCHANCE_MIN_AGREE = parseInt(process.env.POLYARB_CONFLUENCE_LASTCHANCE_MIN ?? '2', 10);
const PHASE2_PANIC_MIN_AGREE = parseInt(process.env.POLYARB_CONFLUENCE_PANIC_MIN ?? '2', 10);
const PHASE2_LASTCHANCE_WINDOW_MS = parseInt(process.env.POLYARB_LASTCHANCE_WINDOW_MS ?? '60000', 10);
const PHASE2_PANIC_WINDOW_MS = parseInt(process.env.POLYARB_PANIC_WINDOW_MS ?? '15000', 10);
const PHASE2_FAVORED_SIDE_INVERSION = (process.env.POLYARB_FAVORED_SIDE_INVERSION ?? '0') === '1';
const PHASE2_MAX_OPEN_POSITIONS = parseInt(process.env.POLYARB_MAX_OPEN_POSITIONS ?? '2', 10);
const PHASE2_NEAR_EXPIRY_BUFFER_MS = parseInt(process.env.POLYARB_NEAR_EXPIRY_BUFFER_MS ?? '60000', 10);
const PHASE2_ENTRY_WINDOW_MS = parseInt(process.env.POLYARB_ENTRY_WINDOW_MS ?? '60000', 10);
const PHASE2_PANIC_FALLBACK_CAP_USD = parseInt(process.env.POLYARB_PANIC_FALLBACK_CAP_USD ?? '25', 10);

type TriggerTier = 'NORMAL' | 'LASTCHANCE' | 'PANIC';
function resolveTriggerTier(msRemaining: number): { tier: TriggerTier; minAgreeing: number } {
  if (msRemaining > PHASE2_LASTCHANCE_WINDOW_MS) {
    return { tier: 'NORMAL', minAgreeing: PHASE2_NORMAL_MIN_AGREE };
  }
  if (msRemaining > PHASE2_PANIC_WINDOW_MS) {
    return { tier: 'LASTCHANCE', minAgreeing: PHASE2_LASTCHANCE_MIN_AGREE };
  }
  return { tier: 'PANIC', minAgreeing: PHASE2_PANIC_MIN_AGREE };
}

// Velocity-detector returns the literal string 'CRYPTO' when the question text
// matches no known crypto. Cast guards prevent passing that bogus value to a
// feed whose state Map only knows BTC/ETH/SOL — without this, a runtime call
// like `getSignal('CRYPTO')` silently returns null and is indistinguishable
// from a stale signal in the logs.
type FeedSymbol = 'BTC' | 'ETH' | 'SOL';
function asFeedSymbol(symbol: string): FeedSymbol | null {
  return symbol === 'BTC' || symbol === 'ETH' || symbol === 'SOL' ? symbol : null;
}

// Engine v2 skip-log throttle. The trading loop iterates every 250ms, so a
// single market stuck in fail_closed / no_confluence floods the log buffer
// with ~14k lines/hour and pushes diagnostic output (WS health, balance,
// derivatives) out of Fly.io's bounded buffer. We log the first occurrence
// of each (slug, reason) pair, then re-log at most once per 60s.
const ENGINE_V2_SKIP_THROTTLE_MS = 60_000;
const engineV2SkipLastLoggedAt: Map<string, number> = new Map();
function logEngineV2Skip(slug: string, reason: string, detail: string): void {
  const key = `${slug}::${reason}`;
  const now = Date.now();
  const last = engineV2SkipLastLoggedAt.get(key) ?? 0;
  if (now - last < ENGINE_V2_SKIP_THROTTLE_MS) return;
  engineV2SkipLastLoggedAt.set(key, now);
  console.log(`[ENGINE_V2] SKIP ${slug} reason=${reason} ${detail}`);
}

// ─── KellyAdjuster500xOptionB ────────────────────────────────────────────────

const SESSION_MULT_AGGRESSIVE: Record<SessionName, number> = {
  'LONDON+NY_OVERLAP': 2.5,
  LONDON_ONLY:         1.9,
  NY_ONLY:             2.2,
  ASIA:                1.0,
};

const SESSION_MULT_SAFE: Record<SessionName, number> = {
  'LONDON+NY_OVERLAP': 2.0,
  LONDON_ONLY:         1.5,
  NY_ONLY:             1.8,
  ASIA:                0.8,
};

/**
 * Thin state-holder used by both the loop and the Day10Validator.
 * Owns the live `dayTenValidationPassed` flag that decides which
 * session-multiplier table is in effect on each tick.
 */
export class KellyAdjuster500xOptionB implements KellyAdjusterDay10Hook {
  dayTenValidationPassed = true;

  constructor(
    public readonly agentId: string,
    public readonly deploymentDate: Date,
  ) {}

  daysRunning(now: Date = new Date()): number {
    const ms = now.getTime() - this.deploymentDate.getTime();
    return Math.floor(ms / 86_400_000);
  }

  setDayTenValidationPassed(passed: boolean): void {
    this.dayTenValidationPassed = passed;
  }

  getEffectiveMultiplier(session: SessionInfo): number {
    const table = this.dayTenValidationPassed ? SESSION_MULT_AGGRESSIVE : SESSION_MULT_SAFE;
    return table[session.name];
  }
}

export interface LoopDeps50x {
  config: FiftyXAgentConfig;
  binanceFeed: BinanceFeed;
  polymarketFeed: PolymarketFeed;
  positionTracker: PositionTracker;
  orderManager: OrderManager;
  telemetryWriter: TelemetryWriter;
  cbState: CircuitBreakerState;
  /** conditionId → parsed milestone price (null = couldn't parse) */
  milestoneMap: Map<string, number | null>;
  fundamentalEngine: FundamentalEngine;
  windowGate: WindowGate;
  calibrationTracker: CalibrationTracker;
  statCB: StatCBState;
  eventDetector: EventDetector;
  macroEventFeed: MacroEventFeed;
  // 500x-only state
  cascadeState: CascadeState;
  scheduler: TradeScheduler;
  realtimeMetrics: RealtimeMetrics;
  anomalyDetector: AnomalyDetector;
  day10Validator: Day10Validator;
  kellyAdjuster500x: KellyAdjuster500xOptionB;
  // Engine v2 feeds — optional so legacy mode (off) can run without instantiating them.
  perpFeed?: BinancePerpFeed;
  ivFeed?: DeribitIVFeed;
}

export interface LoopMetrics50x {
  totalTrades: number;
  wins: number;
  losses: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalPnlUsd: number;
  peakEquity: number;
  lastLatencyMs: number;
  lastSlippage: number;
  errorCount1h: number;
  hestonState: HestonState;
  lastVelocitySignals: VelocitySignal[];
  lastRegime: RegimeState | null;
  lastFundamentalSignal: FundamentalSignal | null;
  realClobBalance: number | null;
  lastEventState: EventState | null;
  lastEventActive: boolean;
  /** Last UTC ms a session-change line was logged (rate-limit). */
  lastSessionLogMs: number;
  /** Last session name that was logged. */
  lastSessionName: SessionName | null;
}

export function createLoopMetrics50x(startingEquity: number): LoopMetrics50x {
  return {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    totalPnlUsd: 0,
    peakEquity: startingEquity,
    lastLatencyMs: 0,
    lastSlippage: 0,
    errorCount1h: 0,
    hestonState: { variance: 0.15, leverage: 2.0 },
    lastVelocitySignals: [],
    lastRegime: null,
    lastFundamentalSignal: null,
    realClobBalance: null,
    lastEventState: inactiveEventState(),
    lastEventActive: false,
    lastSessionLogMs: 0,
    lastSessionName: null,
  };
}

// ─── Profit-take exits ───────────────────────────────────────────────────────

async function checkProfitTakeExits50x(
  deps: LoopDeps50x,
  metrics: LoopMetrics50x,
  session: SessionInfo,
): Promise<void> {
  const { positionTracker, polymarketFeed, orderManager, config } = deps;

  for (const pos of [...positionTracker.open]) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    if (!ob) continue;

    const exitPrice = pos.outcome === 'YES' ? ob.bidPrice : ob.askPrice;
    const unrealizedPnl = (exitPrice - pos.entryPrice) * pos.shares;
    const maxGain = (1 - pos.entryPrice) * pos.shares;
    if (maxGain <= 0) continue;

    // Fixed 70% profit-take (500x strategy: simple, predictable exits)
    const threshold = 0.70;
    if (unrealizedPnl < threshold * maxGain) continue;

    console.log(
      `[500x] PROFIT TAKE ${pos.marketSlug} ${pos.outcome}` +
      ` pnl=+$${unrealizedPnl.toFixed(4)} (${(unrealizedPnl / maxGain * 100).toFixed(1)}% of max)`,
    );

    if (!config.dryRun) {
      const market = polymarketFeed.getMarkets().find(m => m.conditionId === pos.conditionId);
      const sellResult = await orderManager.placeOrder({
        conditionId: pos.conditionId,
        yesTokenId:  market?.yesTokenId ?? pos.conditionId,
        noTokenId:   market?.noTokenId ?? '',
        marketSlug:  pos.marketSlug,
        outcome:     pos.outcome,
        side:        'SELL',
        price:       exitPrice,
        sizeUsd:     pos.shares * exitPrice,
        negRisk:     market?.negRisk ?? true,
        agentId:     config.agentId,
        userId:      config.userId,
      });
      if (!sellResult.success) {
        console.error(`[500x] Profit-take SELL failed for ${pos.marketSlug}: ${sellResult.error ?? 'unknown'}`);
        continue;
      }
    }

    const closed = await positionTracker.closePosition(pos.id, exitPrice, 'profit_take');
    if (closed) {
      recordExit(deps.statCB, pos.conditionId);
      recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd, deps, session);
      deps.cascadeState.reset(pos.conditionId);
      void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');
    }
  }
}

// ─── Cascade entries ─────────────────────────────────────────────────────────

async function processCascades(
  deps: LoopDeps50x,
  metrics: LoopMetrics50x,
): Promise<void> {
  const { positionTracker, polymarketFeed, orderManager, config, cascadeState } = deps;
  const now = Date.now();

  for (const pos of positionTracker.open) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    if (!ob) continue;

    const windowInfo = extractWindowInfo(pos.marketSlug);
    const msLeft = windowInfo ? Math.max(0, windowInfo.windowEnd - now) : 0;
    const currentPrice = pos.outcome === 'YES' ? ob.bidPrice : ob.askPrice;

    const dec = shouldCascade(pos, currentPrice, cascadeState, config.params, msLeft, now);
    if (!dec.add) continue;

    const accountValue = metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd);
    const sizeUsd = accountValue * dec.nextKellyFraction;
    if (sizeUsd < 0.01) continue;

    const entryPrice = pos.outcome === 'YES' ? ob.askPrice : ob.bidPrice;

    console.log(
      `[500x] CASCADE level=${dec.nextLevel} ${pos.marketSlug} ${pos.outcome} ` +
      `kelly=${(dec.nextKellyFraction * 100).toFixed(2)}% size=$${sizeUsd.toFixed(2)} ${dec.reason}`,
    );

    const market = polymarketFeed.getMarkets().find(m => m.conditionId === pos.conditionId);
    const result = await orderManager.placeOrder({
      conditionId: pos.conditionId,
      yesTokenId:  market?.yesTokenId ?? pos.conditionId,
      noTokenId:   market?.noTokenId ?? '',
      marketSlug:  pos.marketSlug,
      marketQuestion: market?.question ?? pos.marketQuestion,
      outcome:     pos.outcome,
      side:        'BUY',
      price:       entryPrice,
      sizeUsd,
      negRisk:     market?.negRisk ?? true,
      agentId:     config.agentId,
      userId:      config.userId,
    });

    if (!result.success) {
      console.error(`[500x] Cascade order failed: ${result.error ?? 'unknown'}`);
      continue;
    }

    const cascadePos = await positionTracker.openPosition({
      marketSlug: pos.marketSlug,
      marketQuestion: market?.question ?? pos.marketQuestion,
      conditionId: pos.conditionId,
      outcome: pos.outcome,
      side: 'BUY',
      entryPrice: result.filledPrice,
      sizeUsd,
      shares: result.filledSize,
      leverageUsed: 1.0,
      entryReason: {
        pillar: '500x-cascade',
        cascadeLevel: dec.nextLevel,
        parentPositionId: pos.id,
        kellyFraction: dec.nextKellyFraction,
      },
    });

    if (cascadePos) {
      cascadeState.recordCascade(pos.conditionId, dec.nextKellyFraction, now);
      void logCompliance(
        config.agentId, config.userId, 'TRADE_ENTRY', cascadePos.id, 'polyarb_positions',
        undefined, { cascadeLevel: dec.nextLevel, kelly: dec.nextKellyFraction },
      );
    }
  }
}

// ─── Main tick ───────────────────────────────────────────────────────────────

export async function tradingTick50x(
  deps: LoopDeps50x,
  metrics: LoopMetrics50x,
): Promise<void> {
  const { config, binanceFeed, polymarketFeed, positionTracker, telemetryWriter, cbState } = deps;
  const { params } = config;
  const tickStart = Date.now();

  // Day-10 gate runs at most once, only inside its UTC window.
  const supabase = getSupabase();
  await deps.day10Validator.validateAndExecute(supabase).catch((err) => {
    console.warn(`[500x] WARN day10Validator threw: ${(err as Error).message}`);
  });

  // Resolve current session and rate-limit the change log.
  const session = deps.scheduler.getCurrentSession();
  const sessionMult = deps.kellyAdjuster500x.getEffectiveMultiplier(session);
  const sessionChanged = metrics.lastSessionName !== session.name;
  const HOUR_MS = 60 * 60_000;
  if (sessionChanged || tickStart - metrics.lastSessionLogMs > HOUR_MS) {
    console.log(
      `[500x] session=${session.name} aggr=${session.aggressivity}` +
      ` kelly_mult=${sessionMult.toFixed(2)}` +
      ` markets=${session.markets_open.join(',')}` +
      ` until_change_h=${session.hours_until_change}` +
      ` table=${deps.kellyAdjuster500x.dayTenValidationPassed ? 'AGGRESSIVE' : 'SAFE'}`,
    );
    metrics.lastSessionLogMs = tickStart;
    metrics.lastSessionName = session.name;
  }

  await runStatisticalChecks(deps.statCB, config.agentId);
  if (deps.statCB.paused) {
    console.warn(`[500x stat-cb] Trading bloqueado: ${deps.statCB.reason}`);
    updateTelemetry50x(deps, metrics, tickStart, session, sessionMult);
    return;
  }

  const btcPrice = binanceFeed.price;
  const orderbooks = polymarketFeed.getAllOrderbooks();
  if (!btcPrice || orderbooks.length === 0) {
    updateTelemetry50x(deps, metrics, tickStart, session, sessionMult);
    return;
  }

  const regime = detectRegime(binanceFeed.getTimestampedSamples('BTC'));
  metrics.lastRegime = regime;

  // Rebase startOfDayEquity to the first real reading we observe so the daily
  // drawdown check compares against actual capital, not the hard-coded
  // startingCapitalUsd. Without this, $0 CLOB balance vs $50 starting = -100%
  // and trips MAX_DAILY_DRAWDOWN before any real activity.
  const liveEquity = metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd);
  rebaseStartOfDay(cbState, liveEquity);

  const cbEvents = checkCircuitBreakers(
    cbState,
    liveEquity,
    metrics.consecutiveLosses,
    metrics.lastLatencyMs,
    metrics.lastSlippage,
    binanceFeed.isConnected,
    polymarketFeed.isConnected,
    params,
  );
  if (cbEvents.length > 0) {
    void logCircuitBreakerEvents(config.agentId, config.userId, cbEvents);
  }

  // Close timed-out positions
  const timedOut = positionTracker.getTimedOutPositions();
  for (const pos of timedOut) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    const exitPrice = ob?.midPrice ?? pos.entryPrice;
    const closed = await positionTracker.closePosition(pos.id, exitPrice, 'timeout');
    if (closed) {
      recordExit(deps.statCB, pos.conditionId);
      recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd, deps, session);
      deps.cascadeState.reset(pos.conditionId);
      void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');
      settleTimedOutPosition(pos, supabase);
    }
  }

  await checkProfitTakeExits50x(deps, metrics, session);

  const fundamental = deps.fundamentalEngine.getSignal();
  metrics.lastFundamentalSignal = fundamental;

  if (fundamental.vetoed) {
    console.log(`[500x] Macro veto — ${fundamental.vetoReason ?? 'macro event'}`);
    drainEvents(cbState);
    updateTelemetry50x(deps, metrics, tickStart, session, sessionMult);
    return;
  }

  // Event detection (used for kelly-cap scaling)
  const eventCanonical = orderbooks[0];
  const obHistory = eventCanonical
    ? deps.polymarketFeed.getOrderbookHistory(eventCanonical.conditionId)
    : [];
  const eventState = deps.eventDetector.evaluate({
    orderbookHistory: obHistory,
    binanceSamples: deps.binanceFeed.getTimestampedSamples('BTC'),
    fundingMomentum: deps.fundamentalEngine.fundingMomentum.get(),
    regime,
    macroNow: deps.macroEventFeed.getCurrentWindow(),
  });
  metrics.lastEventState = eventState;

  if (eventState.active && !metrics.lastEventActive) {
    void logEventToDb50x(deps, eventState).catch(() => {});
    console.log(
      `[500x] EVENT DETECTED type=${eventState.type} severity=${eventState.severity.toFixed(2)}` +
      ` ttl=${eventState.ttlMs}ms reason=${eventState.reason}`,
    );
  }
  metrics.lastEventActive = eventState.active;

  // Process each market
  for (const orderbook of orderbooks) {
    await processMarket50x(
      deps,
      metrics,
      orderbook,
      btcPrice.last,
      regime,
      fundamental,
      eventState,
      session,
      sessionMult,
    );
  }

  // Cascade detection runs AFTER new entries so a cascade does not steal the
  // window from a fresh ENTER on a different market.
  await processCascades(deps, metrics);

  const dt = params.loopIntervalMs / 86_400_000;
  metrics.hestonState = hestonStep(metrics.hestonState.variance, dt, undefined, params.maxLeverage);

  drainEvents(cbState);
  updateTelemetry50x(deps, metrics, tickStart, session, sessionMult);
}

// ─── processMarket50x ────────────────────────────────────────────────────────

async function processMarket50x(
  deps: LoopDeps50x,
  metrics: LoopMetrics50x,
  orderbook: PolymarketOrderbook,
  btcSpotPrice: number,
  regime: RegimeState,
  fundamental: FundamentalSignal,
  eventState: EventState,
  session: SessionInfo,
  sessionMult: number,
): Promise<void> {
  const { config, binanceFeed, positionTracker, orderManager, milestoneMap, calibrationTracker } = deps;
  const { params } = config;

  // Market scope filter
  const prefixes = (process.env.POLYARB_MARKET_SLUG_PREFIXES ?? 'btc-updown-5m-,eth-updown-5m-').split(',');
  if (!prefixes.some(p => orderbook.marketSlug.startsWith(p.trim()))) return;

  const windowInfo = extractWindowInfo(orderbook.marketSlug);
  if (!windowInfo) return;

  const now = Date.now();

  if (isNearExpiry(windowInfo, now, PHASE2_NEAR_EXPIRY_BUFFER_MS)) return;
  if (deps.windowGate.hasEnteredWindow(orderbook.conditionId, orderbook.marketSlug)) return;
  if (!isInEntryWindow(windowInfo, now, PHASE2_ENTRY_WINDOW_MS)) return;

  // Skip if already have an open position on this market
  if (positionTracker.open.some(p => p.conditionId === orderbook.conditionId)) return;

  // Max simultaneous positions (env-configurable; legacy default 2)
  if (positionTracker.openCount >= PHASE2_MAX_OPEN_POSITIONS) return;

  const priceHistory = binanceFeed.history;
  if (priceHistory.length < 10) return;

  // Belief volatility + base fair price
  const sigma = estimateBeliefVolatility(priceHistory, orderbook.bidPrice, orderbook.askPrice);
  const baseFairPrice = computeFairPrice(orderbook.midPrice, sigma);

  // Velocity signal — provides adjustedFairProb (THE fair price model)
  const market = deps.polymarketFeed.getMarkets().find(m => m.conditionId === orderbook.conditionId);
  const milestonePrice = milestoneMap.get(orderbook.conditionId) ?? null;
  const velocitySignal = computeVelocitySignal(
    orderbook.conditionId,
    market?.question ?? orderbook.marketSlug,
    btcSpotPrice,
    binanceFeed.getTimestampedSamples('BTC'),
    orderbook.midPrice,
    baseFairPrice,
    milestonePrice,
  );

  const vsIdx = metrics.lastVelocitySignals.findIndex(s => s.conditionId === orderbook.conditionId);
  if (vsIdx >= 0) metrics.lastVelocitySignals[vsIdx] = velocitySignal;
  else metrics.lastVelocitySignals.push(velocitySignal);

  // Calibration bias
  const calibration = calibrationTracker.getSignal(velocitySignal.symbol, orderbook.midPrice);
  const fairPrice = Math.max(0.01, Math.min(0.99, velocitySignal.adjustedFairProb + calibration.biasCorrection));

  // Edge + fundamental multiplier
  let edge = computeEdge(fairPrice, orderbook.midPrice);
  const tradingBullish = edge > 0;
  edge *= compositeEdgeMultiplier(fundamental.compositeScore, tradingBullish);

  // Signed gap = adjusted fair prob minus market price
  const gap = fairPrice - orderbook.midPrice;

  // ─── Engine v2 pre-validator gates (favored-side + multi-source confluence) ─
  // Runs only when ENGINE_V2_MODE !== 'off'. Fail-closed: any missing/stale
  // perp or IV signal forces SKIP. Spot direction derives from sign(gap).
  //
  // Phase 2 changes:
  //   - midPrice gate respects FAVORED_SIDE_INVERSION: if model says buyNo
  //     and YES_mid<=0.50, NO_mid>0.50 = favored side → ALLOW. Legacy
  //     behavior (skip whenever YES_mid<=0.50) is preserved when the env
  //     flag is off.
  //   - Confluence threshold scales by tier: NORMAL > LASTCHANCE > PANIC
  //     based on time remaining in the 5-min window.
  //   - When PANIC tier passes with cap=0 (sourcesAgreeing=0), apply a
  //     flat $25 fallback so the panic-trade can fire on velocity-detector
  //     alone.
  const v2BuyYes = gap > 0;
  const spotDirection = Math.abs(gap) < 1e-6 ? 'NEUTRAL' : (v2BuyYes ? 'UP' : 'DOWN');
  const msRemaining = Math.max(0, windowInfo.windowEnd - now);
  const triggerInfo = resolveTriggerTier(msRemaining);
  let confluenceCapUsd: number | null = null;
  let confluenceSnapshot: {
    agreeing: number;
    available: number;
    direction: string;
    cap: number;
    perpDir: string | null;
    ivDir: string | null;
    triggerTier: TriggerTier;
    msRemaining: number;
    invertedSide: boolean;
    requiredAgreeing: number;
  } | null = null;
  if (ENGINE_V2_MODE !== 'off') {
    // Favored-side gate. The favored side has price > 0.50. We always trade
    // the favored side. If model direction picks the unfavored side, SKIP.
    const wantsYes = v2BuyYes;
    const yesIsFavored = orderbook.midPrice > 0.50;
    const buyingFavored = wantsYes ? yesIsFavored : !yesIsFavored;
    const invertedSide = !wantsYes && !yesIsFavored; // model says buyNo and YES is unfavored → buying NO favored side
    if (!buyingFavored) {
      // wantsYes && !yesIsFavored OR !wantsYes && yesIsFavored: model picks unfavored side.
      logEngineV2Skip(
        orderbook.marketSlug,
        'unfavored_side',
        `mid=${orderbook.midPrice.toFixed(3)} buyYes=${wantsYes}`,
      );
      return;
    }
    if (invertedSide && !PHASE2_FAVORED_SIDE_INVERSION) {
      // Legacy behavior: skip any market with YES_mid<=0.50 even when model
      // would have correctly picked the NO favored side.
      logEngineV2Skip(
        orderbook.marketSlug,
        'midprice_below_favorite',
        `mid=${orderbook.midPrice.toFixed(3)}`,
      );
      return;
    }

    const feedSymbol = asFeedSymbol(velocitySignal.symbol);
    if (!feedSymbol) {
      logEngineV2Skip(
        orderbook.marketSlug,
        'unsupported_symbol',
        `symbol=${velocitySignal.symbol}`,
      );
      return;
    }

    const perpSig = deps.perpFeed?.getSignal(feedSymbol) ?? null;
    const ivSig = deps.ivFeed?.getSignal(feedSymbol) ?? null;
    const confluence = evaluateConfluence({
      spotDirection,
      perpSignal: perpSig,
      ivSignal: ivSig,
      buyYes: v2BuyYes,
    });

    if (confluence.failClosed) {
      logEngineV2Skip(
        orderbook.marketSlug,
        'fail_closed',
        `detail=${confluence.failReason}`,
      );
      return;
    }
    if (confluence.sourcesAgreeing < triggerInfo.minAgreeing) {
      logEngineV2Skip(
        orderbook.marketSlug,
        'no_confluence',
        `agreeing=${confluence.sourcesAgreeing}/${triggerInfo.minAgreeing}` +
        ` tier=${triggerInfo.tier} t-${Math.round(msRemaining / 1000)}s` +
        ` dir=${confluence.agreedDirection}`,
      );
      return;
    }
    // Direction conflict only enforced when at least one source agreed
    // (matchesBuyDirection compares the majority direction to buyYes; a
    // sourcesAgreeing=0 PANIC trade has agreedDirection=NEUTRAL, which never
    // matches — but the spot signal alone already implies the buy direction).
    if (confluence.sourcesAgreeing > 0 && !confluence.matchesBuyDirection) {
      logEngineV2Skip(
        orderbook.marketSlug,
        'direction_conflict',
        `confluence=${confluence.agreedDirection} buyYes=${v2BuyYes}` +
        ` tier=${triggerInfo.tier}`,
      );
      return;
    }

    // Sizing cap: confluence engine returns 0 for sourcesAgreeing=0. In
    // PANIC tier we substitute the flat fallback so the panic-trade fires.
    const baseCap = confluence.kellyCapUsd;
    confluenceCapUsd = baseCap > 0
      ? baseCap
      : (triggerInfo.tier === 'PANIC' ? PHASE2_PANIC_FALLBACK_CAP_USD : 0);
    if (confluenceCapUsd <= 0) {
      logEngineV2Skip(
        orderbook.marketSlug,
        'no_kelly_cap',
        `tier=${triggerInfo.tier} agreeing=${confluence.sourcesAgreeing}`,
      );
      return;
    }
    confluenceSnapshot = {
      agreeing: confluence.sourcesAgreeing,
      available: confluence.sourcesAvailable,
      direction: confluence.agreedDirection,
      cap: confluenceCapUsd,
      perpDir: perpSig?.direction ?? null,
      ivDir: ivSig?.direction ?? null,
      triggerTier: triggerInfo.tier,
      msRemaining,
      invertedSide,
      requiredAgreeing: triggerInfo.minAgreeing,
    };
    console.log(
      `[ENGINE_V2] PASS ${orderbook.marketSlug} agreeing=${confluence.sourcesAgreeing}/3` +
      ` dir=${confluence.agreedDirection} cap=$${confluenceCapUsd}` +
      ` tier=${triggerInfo.tier} t-${Math.round(msRemaining / 1000)}s` +
      ` inverted=${invertedSide}`,
    );
  }

  // Reversal signal (L3 input)
  const reversalSignal = computeReversalSignal(priceHistory);

  // 5-Layer validation
  const msLeftInWindow = Math.max(0, windowInfo.windowEnd - now);
  const fiveLayer = fiveLayerValidate({
    gap,
    regime,
    reversal: reversalSignal,
    msLeftInWindow,
    minEdgePercent: params.minEdgePercent,
  });

  console.log(
    `[500x] ${orderbook.marketSlug} L1=${fmt(fiveLayer.layers[0]?.score)} L2=${fmt(fiveLayer.layers[1]?.score)}` +
    ` L3=${fmt(fiveLayer.layers[2]?.score)} L4=${fmt(fiveLayer.layers[3]?.score)} L5=${fmt(fiveLayer.layers[4]?.score)}` +
    ` conf=${fiveLayer.overallConfidence.toFixed(2)} valid=${fiveLayer.validatedCount}/5`,
  );

  // Decision tier
  const decision = decide(gap, fiveLayer, params);
  if (decision.decision === 'SKIP') {
    console.log(`[500x] SKIP ${orderbook.marketSlug} — ${decision.reason}`);
    return;
  }

  // Direction follows the sign of `gap` (positive → fair price above market → buy YES)
  const buyYes = gap > 0;

  // Claim window before any await
  deps.windowGate.markEntered(orderbook.conditionId, orderbook.marketSlug);

  // Kelly sizing
  const accountValue = metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd);
  const effectiveCap = effectiveKellyCap(params.maxKellyFraction, eventState, params.flagAggressive);
  // Polymarket binary: orderbook fields are YES-side. NO_ask = 1 - YES_bid.
  // For a BUY on the NO outcome we lift the NO ask, not the YES bid.
  const entryPrice = buyYes ? orderbook.askPrice : (1 - orderbook.bidPrice);

  const kellyBase = asymmetricKelly(edge, entryPrice, effectiveCap, accountValue);

  const drawdown = metrics.peakEquity > 0
    ? Math.max(0, (metrics.peakEquity - accountValue) / metrics.peakEquity)
    : 0;

  const adjusted = adjustKelly({
    baseFraction: kellyBase.fraction,
    gap,
    confidence: fiveLayer.overallConfidence,
    consecutiveWins: metrics.consecutiveWins,
    drawdown,
    decision: decision.decision,
    ceiling: effectiveCap,
    params,
    sessionMultiplier: sessionMult,
  });

  // Engine v2 sizing cap: confluenceCapUsd is the hard ceiling derived from
  // sourcesAgreeing (1=$25, 2=$50, 3=$100). Only applied when v2 mode is on
  // and the confluence gate passed (cap is non-null).
  const kellyDerivedSize = accountValue * adjusted.fraction;
  const finalSize = confluenceCapUsd != null
    ? Math.min(kellyDerivedSize, confluenceCapUsd)
    : kellyDerivedSize;
  if (finalSize < 0.01) {
    console.log(`[500x] SKIP ${orderbook.marketSlug} — kelly_size_negligible (${finalSize.toFixed(4)})`);
    return;
  }

  console.log(
    `[500x] DECISION=${decision.decision} ${orderbook.marketSlug} ${buyYes ? 'YES' : 'NO'}` +
    ` gap=${(gap * 100).toFixed(2)}% conf=${fiveLayer.overallConfidence.toFixed(2)}` +
    ` kelly=${(adjusted.fraction * 100).toFixed(2)}% size=$${finalSize.toFixed(2)}` +
    ` session=${session.name}` +
    ` mults=[g${adjusted.multipliers.gap.toFixed(2)} c${adjusted.multipliers.confidence.toFixed(2)}` +
    ` s${adjusted.multipliers.streak.toFixed(2)} d${adjusted.multipliers.drawdown.toFixed(2)}` +
    ` t${adjusted.multipliers.tier.toFixed(2)} S${adjusted.multipliers.session.toFixed(2)}]`,
  );

  // Engine v2 dryrun branch: log what would have executed and exit before
  // touching the order manager. Window claim already happened above, which is
  // intentional — dryrun must compete with itself for windows the same way
  // live mode would, otherwise the 24h validation rate is overstated.
  if (ENGINE_V2_MODE === 'dryrun') {
    console.log(
      `[ENGINE_V2] DRYRUN would_execute ${orderbook.marketSlug} ${v2BuyYes ? 'YES' : 'NO'}` +
      ` mid=${orderbook.midPrice.toFixed(3)} gap=${(gap * 100).toFixed(2)}%` +
      ` conf=${fiveLayer.overallConfidence.toFixed(2)} valid=${fiveLayer.validatedCount}/5` +
      ` size=$${finalSize.toFixed(2)} cap=$${confluenceCapUsd ?? 0}` +
      ` decision=${decision.decision} session=${session.name}`,
    );
    return;
  }

  // Execute order
  const result = await orderManager.placeOrder({
    conditionId: orderbook.conditionId,
    yesTokenId: market?.yesTokenId ?? orderbook.conditionId,
    noTokenId:  market?.noTokenId ?? '',
    marketSlug: orderbook.marketSlug,
    marketQuestion: market?.question,
    outcome:    buyYes ? 'YES' : 'NO',
    side:       'BUY',
    price:      entryPrice,
    sizeUsd:    finalSize,
    negRisk:    market?.negRisk ?? true,
    agentId:    config.agentId,
    userId:     config.userId,
  });

  metrics.lastLatencyMs = result.executionLatencyMs;
  metrics.lastSlippage = result.slippageBps / 10_000;

  if (!result.success) {
    metrics.errorCount1h++;
    console.error(`[500x] Order failed (${orderbook.marketSlug}): ${result.error ?? 'unknown'}`);
    return;
  }

  const position = await positionTracker.openPosition({
    marketSlug: orderbook.marketSlug,
    marketQuestion: market?.question,
    conditionId: orderbook.conditionId,
    outcome: buyYes ? 'YES' : 'NO',
    side: 'BUY',
    entryPrice: result.filledPrice,
    sizeUsd: finalSize,
    shares: result.filledSize,
    leverageUsed: 1.0,
    entryReason: {
      pillar: '500x-five-layer',
      decision: decision.decision,
      cascadeLevel: 0,
      gap,
      fairPrice,
      calibrationBias: calibration.biasCorrection,
      kellyFraction: adjusted.fraction,
      kellyBaseFraction: kellyBase.fraction,
      kellyMultipliers: adjusted.multipliers,
      regime: regime.regime,
      fiveLayer: fiveLayer.layers.map(l => ({ name: l.name, score: l.score, valid: l.isValid })),
      overallConfidence: fiveLayer.overallConfidence,
      eventType: eventState.active ? eventState.type : null,
      eventSeverity: eventState.active ? eventState.severity : 0,
      eventCap: effectiveCap,
      session: session.name,
      sessionMultiplier: sessionMult,
      engineV2Mode: ENGINE_V2_MODE,
      confluence: confluenceSnapshot,
    },
  });

  if (position) {
    metrics.totalTrades++;
    deps.cascadeState.recordOriginal(orderbook.conditionId, adjusted.fraction, now);
    void logCompliance(
      config.agentId, config.userId, 'TRADE_ENTRY', position.id, 'polyarb_positions',
      undefined,
      {
        decision: decision.decision,
        kelly: adjusted.fraction,
        confidence: fiveLayer.overallConfidence,
        gap,
        regime: regime.regime,
        session: session.name,
      },
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(score: number | undefined): string {
  return score === undefined ? 'n/a' : score.toFixed(2);
}

function recordTradeResult(
  metrics: LoopMetrics50x,
  pnlUsd: number,
  startingCapital: number,
  deps: LoopDeps50x,
  session: SessionInfo,
): void {
  metrics.totalPnlUsd += pnlUsd;

  if (pnlUsd > 0) {
    metrics.wins++;
    metrics.consecutiveWins++;
    metrics.consecutiveLosses = 0;
  } else if (pnlUsd < 0) {
    metrics.losses++;
    metrics.consecutiveLosses++;
    metrics.consecutiveWins = 0;
  }

  const currentEquity = startingCapital + metrics.totalPnlUsd;
  if (currentEquity > metrics.peakEquity) metrics.peakEquity = currentEquity;

  // Realtime metrics + anomaly detection
  const accountBase = startingCapital > 0 ? startingCapital : Math.max(currentEquity, 1);
  const pnlPercent = pnlUsd / accountBase;
  const trade = {
    pnl: pnlUsd,
    pnlPercent,
    expectedValue: pnlPercent,
    session: session.name,
    confidence: 0,
    slippage: metrics.lastSlippage,
    executionTimeMs: metrics.lastLatencyMs,
    timestamp: Date.now(),
  };
  const history = deps.realtimeMetrics.getRecentTrades(200);
  deps.realtimeMetrics.recordTrade(trade);

  try {
    const stats = AnomalyDetector.computeStats(history);
    const anomaly = deps.anomalyDetector.detectAnomalies(trade, stats);
    if (anomaly.isAnomaly) {
      console.warn(`[500x] ANOMALY ${anomaly.severity}: ${anomaly.reasons.join(' | ')}`);
    }
  } catch (err) {
    console.warn(`[500x] WARN anomaly detection threw: ${(err as Error).message}`);
  }
}

function updateTelemetry50x(
  deps: LoopDeps50x,
  metrics: LoopMetrics50x,
  tickStart: number,
  session: SessionInfo,
  sessionMult: number,
): void {
  const { config, binanceFeed, polymarketFeed, positionTracker, telemetryWriter } = deps;
  const loopLatencyMs = Date.now() - tickStart;
  const openPositionsValue = positionTracker.open.reduce((s: number, p: Position) => s + p.sizeUsd, 0);
  const equity = metrics.realClobBalance != null
    ? metrics.realClobBalance + openPositionsValue
    : config.startingCapitalUsd + metrics.totalPnlUsd;
  const totalTrades = metrics.wins + metrics.losses;
  const maxDrawdown = metrics.peakEquity > 0
    ? ((metrics.peakEquity - equity) / metrics.peakEquity) * 100
    : 0;

  telemetryWriter.update({
    agentId: config.agentId,
    userId: config.userId,
    equityUsd: equity,
    availableBalanceUsd: metrics.realClobBalance ?? (equity - openPositionsValue),
    openPositionsCount: positionTracker.openCount,
    totalPnlUsd: metrics.totalPnlUsd,
    winRate: totalTrades > 0 ? (metrics.wins / totalTrades) * 100 : null,
    profitFactor: null,
    sharpeRatio: null,
    maxDrawdownPct: maxDrawdown,
    loopLatencyMs,
    wsBinanceConnected: binanceFeed.isConnected,
    wsPolymarketConnected: polymarketFeed.isConnected,
    btcSpotPrice: binanceFeed.price?.last ?? null,
    consecutiveWins: metrics.consecutiveWins,
    consecutiveLosses: metrics.consecutiveLosses,
    lastSignal: {
      strategy: '500x',
      session: session.name,
      sessionMult,
      table: deps.kellyAdjuster500x.dayTenValidationPassed ? 'AGGRESSIVE' : 'SAFE',
      daysRunning: deps.kellyAdjuster500x.daysRunning(),
    },
    errorCount1h: metrics.errorCount1h,
    velocitySnapshot: metrics.lastVelocitySignals.length > 0 ? metrics.lastVelocitySignals : null,
    regimeSnapshot: metrics.lastRegime,
    adaptiveKellyState: null,
    crossMarketSnapshot: null,
    sentimentSnapshot: null,
    memoryBankStats: null,
    eventState: metrics.lastEventState,
  });
}

async function logEventToDb50x(deps: LoopDeps50x, event: EventState): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('polyarb_event_log').insert({
      agent_id:    deps.config.agentId,
      user_id:     deps.config.userId,
      event_type:  event.type,
      severity:    event.severity,
      detected_at: new Date(event.detectedAt).toISOString(),
      ttl_ms:      event.ttlMs,
      metadata:    { reason: event.reason, strategy: '500x' },
    });
  } catch {
    // Silent
  }
}
