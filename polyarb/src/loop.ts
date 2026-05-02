/**
 * Main Trading Loop — runs every 250ms
 *
 * Pipeline per tick:
 * 1. Read feeds (BTC/ETH/SOL prices + Polymarket orderbook)
 * 2. Detect market regime [SP#5 Regime Detector]
 * 3. Compute belief volatility + base fair price
 * 4. Apply Velocity Detector [SP#1] → velocity-adjusted fair price
 * 5. Apply Sentiment Pulse [SP#4] → edge multiplier from orderbook anomalies
 * 6. Apply Cross-Market Confirmation [SP#6] → confirm with ETH/SOL
 * 7. Apply Memory Bank filter [SP#2] → skip historically bad conditions
 * 8. Apply Adaptive Kelly threshold [SP#3] → dynamic min edge
 * 9. Kelly sizing
 * 10. Risk/reward check
 * 11. Execute order
 * 12. Check circuit breakers
 * 13. Update telemetry
 */

import type { AgentConfig } from './config.js';
import type { BinanceFeed } from './feeds/binance-ws.js';
import type { PolymarketFeed, PolymarketOrderbook } from './feeds/polymarket-ws.js';
import type { PositionTracker } from './trading/position-tracker.js';
import type { OrderManager } from './trading/order-manager.js';
import type { TelemetryWriter } from './telemetry/writer.js';
import {
  checkCircuitBreakers,
  drainEvents,
  rebaseStartOfDay,
  type CircuitBreakerState,
} from './trading/circuit-breaker.js';
import { logCircuitBreakerEvents, logCompliance } from './telemetry/compliance.js';
import { estimateBeliefVolatility, computeFairPrice, computeEdge } from './math/jump-diffusion.js';
import { calculateMomentumVector } from './math/momentum-physics.js';

import { hestonStep, type HestonState } from './math/heston-vol.js';

// ── Superpowers ──────────────────────────────────────────────────────────────
import {
  computeVelocitySignal,
  type VelocitySignal,
} from './skills/velocity-detector.js';
import { detectRegime, type RegimeState } from './skills/regime-detector.js';
import { AdaptiveKelly } from './skills/adaptive-kelly.js';
import { type MemoryBank } from './skills/memory-bank.js';
import { computeCrossMarketSignal, type CrossMarketSignal } from './skills/cross-market.js';
import { type SentimentPulseTracker, type SentimentPulse } from './skills/sentiment-pulse.js';
import { type FundamentalEngine, compositeEdgeMultiplier } from './analysis/fundamental-engine.js';
import type { FundamentalSignal } from './analysis/types.js';
import { settleTimedOutPosition } from './skills/settlement-engine.js';
import { getSupabase } from './supabase.js';
import { WindowGate, extractWindowInfo, isInEntryWindow, isNearExpiry } from './trading/window-gate.js';

// ── Level-150 Engine Imports ──────────────────────────────────────────────────
import { asymmetricKelly } from './math/asymmetric-kelly.js';
import { computeDepthSignal, type DepthSignal } from './skills/orderbook-depth.js';
import { updateStasisBuffer, computeStasisSignal, type StasisSignal } from './skills/stasis-breakout.js';
import { computeEntropySignal, type EntropySignal } from './skills/entropy-detector.js';
import { computeReversalSignal, type ReversalSignal } from './skills/reversal-radar.js';
import { computeDivergenceSignal, type DivergenceSignal } from './skills/sentiment-divergence.js';
import { computeConsensusThresholds, recentWinRate as computeRecentWinRate } from './skills/adaptive-consensus.js';
import { computeProfitTakePct } from './skills/adaptive-profit-take.js';
import { spoofingDetector } from './skills/spoofing-detector.js';
import { type BayesianWinRate, type BayesianEstimate } from './skills/bayesian-winrate.js';
import { type SessionClock, type SessionSignal } from './skills/session-clock.js';
import { type ReplaySimilarity, type ReplaySignal } from './skills/replay-similarity.js';
import { type CalibrationTracker } from './skills/calibration-tracker.js';
import type { FundingMomentumSignal } from './analysis/providers/funding-momentum.js';
import {
  createStatCBState,
  recordExit,
  runStatisticalChecks,
  type StatCBState,
} from './trading/statistical-circuit-breaker.js';
import { EventDetector, inactiveEventState, type EventState } from './skills/event-detector.js';
import { MacroEventFeed } from './feeds/macro-event-feed.js';
import { effectiveKellyCap } from './skills/dynamic-kelly-cap.js';
import { shouldExitOnEventReversal } from './skills/event-position-manager.js';

export interface LoopDeps {
  config: AgentConfig;
  binanceFeed: BinanceFeed;
  polymarketFeed: PolymarketFeed;
  positionTracker: PositionTracker;
  orderManager: OrderManager;
  telemetryWriter: TelemetryWriter;
  cbState: CircuitBreakerState;
  /** conditionId → parsed milestone price (null = couldn't parse) */
  milestoneMap: Map<string, number | null>;
  // Superpowers
  adaptiveKelly: AdaptiveKelly;
  memoryBank: MemoryBank;
  sentimentPulse: SentimentPulseTracker;
  fundamentalEngine: FundamentalEngine;
  windowGate: WindowGate;
  // Level-150 engines
  bayesianWinRate: BayesianWinRate;
  sessionClock: SessionClock;
  replaySimilarity: ReplaySimilarity;
  calibrationTracker: CalibrationTracker;
  // Observability
  statCB: StatCBState;
  // Event-driven volatility capture (hybrid mode)
  eventDetector: EventDetector;
  macroEventFeed: MacroEventFeed;
}

interface LoopMetrics {
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
  /** Latest velocity signals per market — written to telemetry */
  lastVelocitySignals: VelocitySignal[];
  /** Latest regime state */
  lastRegime: RegimeState | null;
  /** Latest cross-market signal */
  lastCrossMarket: CrossMarketSignal | null;
  /** Latest sentiment pulses */
  lastSentimentPulses: SentimentPulse[];
  /** Per-market timestamp of last order attempt (success or fail) — proxy cooldown */
  lastOrderAttemptAt: Map<string, number>;
  /** Latest fundamental signal — written to telemetry */
  lastFundamentalSignal: FundamentalSignal | null;
  /** Real CLOB balance from last successful fetchBalance() */
  realClobBalance: number | null;
  /** Latest EventDetector output — read by processMarket + telemetry */
  lastEventState: EventState | null;
  /** Last seen "active" event type — used to detect false→true edges for DB log */
  lastEventActive: boolean;
}

export function createLoopMetrics(startingEquity: number): LoopMetrics {
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
    lastCrossMarket: null,
    lastSentimentPulses: [],
    lastOrderAttemptAt: new Map(),
    lastFundamentalSignal: null,
    realClobBalance: null,
    lastEventState: inactiveEventState(),
    lastEventActive: false,
  };
}

// ─── Profit-take exit ────────────────────────────────────────────────────────

async function checkProfitTakeExits(
  deps: LoopDeps,
  metrics: LoopMetrics,
): Promise<void> {
  const { positionTracker, polymarketFeed, orderManager, config, binanceFeed } = deps;

  // Compute shared signals once for all open positions
  const priceHistory = binanceFeed.history;
  const vel5mDir = metrics.lastVelocitySignals[0]?.windows.find(w => w.label === '5m')?.direction ?? 'FLAT';
  const exitEntropySignal  = priceHistory.length >= 10
    ? computeEntropySignal(priceHistory, vel5mDir as 'UP' | 'DOWN' | 'FLAT')
    : null;
  const exitReversalSignal = priceHistory.length >= 10 ? computeReversalSignal(priceHistory) : null;

  const eventState = metrics.lastEventState ?? inactiveEventState();
  const flagAggressive = config.params.flagAggressive;

  for (const pos of [...positionTracker.open]) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    if (!ob) continue;

    // Sell at bid (YES tokens) or ask (NO tokens) — conservative exit price
    const exitPrice = pos.outcome === 'YES' ? ob.bidPrice : ob.askPrice;
    const unrealizedPnl = (exitPrice - pos.entryPrice) * pos.shares;
    const maxGain = (1 - pos.entryPrice) * pos.shares;
    if (maxGain <= 0) continue;

    // Event-driven early exit: if position was opened during an event and the move
    // has reversed by ≥50% of severity, exit immediately rather than waiting for PT.
    const exitNow = Date.now();
    if (flagAggressive && eventState.active) {
      const velocity = metrics.lastVelocitySignals.find(v => v.symbol === (pos.marketSlug.startsWith('eth') ? 'ETH' : 'BTC')) ?? null;
      const reversal = shouldExitOnEventReversal(pos, velocity, eventState, exitNow);
      if (reversal.exit) {
        console.log(`[loop] EVENT REVERSAL EXIT ${pos.marketSlug} ${pos.outcome} reason=${reversal.reason}`);
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
            console.error(`[loop] Event-reversal SELL failed for ${pos.marketSlug}: ${sellResult.error ?? 'unknown'} — keeping open`);
            continue;
          }
        }
        const closed = await positionTracker.closePosition(pos.id, exitPrice, 'event_reversal');
        if (closed) {
          recordExit(deps.statCB, pos.conditionId);
          recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd);
          deps.adaptiveKelly.recordOutcome({
            conditionId: pos.conditionId,
            edge:        0,
            pnlUsd:      closed.pnlUsd,
            won:         closed.pnlUsd > 0,
            symbol:      pos.marketSlug.startsWith('eth') ? 'ETH' : 'BTC',
            computedAt:  Date.now(),
          });
          void deps.memoryBank.recordOutcome(pos.id, closed.pnlUsd);
          void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');
        }
        continue;
      }
    }

    // E3 Adaptive Profit-Take: dynamic 60-85% threshold (30-70% during events) based on market conditions
    const windowInfo = extractWindowInfo(pos.marketSlug);
    const msLeftInWindow = (windowInfo && isNearExpiry(windowInfo, exitNow, 90_000)) ? 45_000 : 300_000;
    const ptResult = computeProfitTakePct(
      exitEntropySignal,
      exitReversalSignal,
      msLeftInWindow,
      metrics.lastRegime,
      eventState,
      flagAggressive,
    );

    if (unrealizedPnl < ptResult.threshold * maxGain) continue;

    console.log(
      `[loop] PROFIT TAKE adaptive ${pos.marketSlug} ${pos.outcome}` +
      ` pnl=+$${unrealizedPnl.toFixed(4)} (${(unrealizedPnl / maxGain * 100).toFixed(1)}% of max)` +
      ` threshold=${(ptResult.threshold * 100).toFixed(0)}% [${ptResult.reason}]`
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
        console.error(`[loop] Profit-take SELL failed for ${pos.marketSlug}: ${sellResult.error ?? 'unknown'} — keeping position open`);
        continue;
      }
    }

    const closed = await positionTracker.closePosition(pos.id, exitPrice, 'profit_take');
    if (closed) {
      recordExit(deps.statCB, pos.conditionId);
      recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd);
      deps.adaptiveKelly.recordOutcome({
        conditionId: pos.conditionId,
        edge:        0,
        pnlUsd:      closed.pnlUsd,
        won:         closed.pnlUsd > 0,
        symbol:      pos.marketSlug.startsWith('eth') ? 'ETH' : 'BTC',
        computedAt:  Date.now(),
      });
      void deps.memoryBank.recordOutcome(pos.id, closed.pnlUsd);
      void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');
    }
  }
}

/**
 * Single tick of the trading loop.
 */
export async function tradingTick(
  deps: LoopDeps,
  metrics: LoopMetrics
): Promise<void> {
  const { config, binanceFeed, polymarketFeed, positionTracker, orderManager, telemetryWriter, cbState } = deps;
  const { params } = config;
  const tickStart = Date.now();

  // ── Statistical Circuit Breaker — DB check every 5 min, blocks trading if triggered ──
  await runStatisticalChecks(deps.statCB, config.agentId);
  if (deps.statCB.paused) {
    console.warn(`[stat-cb] Trading bloqueado: ${deps.statCB.reason}`);
    updateTelemetry(deps, metrics, tickStart);
    return;
  }

  // ── 1. Read feeds ──
  const btcPrice = binanceFeed.price;
  const orderbooks = polymarketFeed.getAllOrderbooks();

  if (!btcPrice || orderbooks.length === 0) {
    updateTelemetry(deps, metrics, tickStart);
    return;
  }

  // ── SP#5 Regime Detector — classify market before any trading decisions ──
  const regime = detectRegime(binanceFeed.getTimestampedSamples('BTC'));
  metrics.lastRegime = regime;

  // ── Check circuit breakers ──
  // Rebase startOfDayEquity to the first real reading so daily DD compares
  // against actual capital (not the hard-coded startingCapitalUsd). Otherwise
  // a $0 CLOB balance vs $50 starting trips MAX_DAILY_DRAWDOWN at -100%.
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
    params
  );

  if (cbEvents.length > 0) {
    void logCircuitBreakerEvents(config.agentId, config.userId, cbEvents);
    // Circuit breaker close-all removed — Kelly sizing manages position risk dynamically
  }

  // tradingEnabled gate removed — super-aggressive mode, no agent-decided halts

  // ── Close timed-out positions — uses slug expiry timestamp internally ──
  const timedOut = positionTracker.getTimedOutPositions();
  for (const pos of timedOut) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    const exitPrice = ob?.midPrice ?? pos.entryPrice;
    const closed = await positionTracker.closePosition(pos.id, exitPrice, 'timeout');
    if (closed) {
      recordExit(deps.statCB, pos.conditionId);
      recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd);
      deps.adaptiveKelly.recordOutcome({
        conditionId: pos.conditionId,
        edge: 0,
        pnlUsd: closed.pnlUsd,
        won: closed.pnlUsd > 0,
        symbol: 'BTC',
        computedAt: Date.now(),
      });
      void deps.memoryBank.recordOutcome(pos.id, closed.pnlUsd);
      void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');

      // Trigger settlement: poll gamma for winner, wait for CLOB credit, update real P&L
      settleTimedOutPosition(pos, getSupabase());
    }
  }

  // ── Profit-take exits ──
  await checkProfitTakeExits(deps, metrics);

  // ── SP#6 Cross-Market Confirmation — computed once per tick ──
  const crossMarket = computeCrossMarketSignal(
    'BTC',
    btcPrice.last > 0 ? 'UP' : 'DOWN', // placeholder — refined per market below
    binanceFeed.getTimestampedSamples('BTC'),
    binanceFeed.getTimestampedSamples('ETH'),
    binanceFeed.getTimestampedSamples('SOL'),
  );
  metrics.lastCrossMarket = crossMarket;

  // ── SP#4 Sentiment Pulses — computed once per tick ──
  metrics.lastSentimentPulses = deps.sentimentPulse.computeAll();

  // ── Fundamental Engine — sync (cached), never blocks the loop ──
  const fundamental = deps.fundamentalEngine.getSignal();
  metrics.lastFundamentalSignal = fundamental;

  // Macro guard veto: block ALL markets if a high-impact event is near
  if (fundamental.vetoed) {
    console.log(`[loop] Macro veto — ${fundamental.vetoReason ?? 'macro event'}`);
    drainEvents(cbState);
    updateTelemetry(deps, metrics, tickStart);
    return;
  }

  // ── Event Detection (hybrid mode trigger) ──
  // Use the orderbook history of the first market with depth as the canonical
  // history for spread/volume/odds-cliff detection. Velocity uses BTC samples.
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

  // Edge-trigger DB log (false → true transition only)
  if (eventState.active && !metrics.lastEventActive) {
    void logEventToDb(deps, eventState).catch(() => {});
    console.log(
      `[loop] EVENT DETECTED type=${eventState.type} severity=${eventState.severity.toFixed(2)}` +
      ` ttl=${eventState.ttlMs}ms reason=${eventState.reason}`
    );
  }
  metrics.lastEventActive = eventState.active;

  // ── Process each market ──
  for (const orderbook of orderbooks) {
    await processMarket(deps, metrics, orderbook, btcPrice.last, regime, crossMarket, fundamental, eventState);
  }

  // ── Evolve Heston vol ──
  const dt = params.loopIntervalMs / 86_400_000;
  metrics.hestonState = hestonStep(metrics.hestonState.variance, dt, undefined, params.maxLeverage);

  drainEvents(cbState);
  updateTelemetry(deps, metrics, tickStart);
}

// ─── Engine voting ────────────────────────────────────────────────────────────

interface EngineVote {
  engine: string;
  direction: 'YES' | 'NO';
  confidence: number; // 0-1
}

interface ExtendedSignals {
  depth: DepthSignal | null;
  stasis: StasisSignal | null;
  entropy: EntropySignal | null;
  reversal: ReversalSignal | null;
  divergence: DivergenceSignal | null;
  fundingMomentum: FundingMomentumSignal | null;
  session: SessionSignal | null;
  bayesian: BayesianEstimate | null;
  replay: ReplaySignal | null;
  velocityDirection: 'UP' | 'DOWN' | 'FLAT';
}

function computeEngineVotes(
  velocitySignal: VelocitySignal,
  sentimentMultiplier: number,
  fundamental: FundamentalSignal,
  edge: number,
  kellyMinEdge: number,
  ext: ExtendedSignals,
): EngineVote[] {
  const votes: EngineVote[] = [];
  const velDir = ext.velocityDirection;
  const velYes: 'YES' | 'NO' = velDir === 'UP' ? 'YES' : 'NO';
  const velNo:  'YES' | 'NO' = velDir === 'UP' ? 'NO'  : 'YES';

  // Original 4 ──────────────────────────────────────────────────────────────

  // Velocity: 5m window direction — strength derived from normalised velocity magnitude
  const vel5m = velocitySignal.windows.find(w => w.label === '5m');
  if (vel5m && vel5m.direction !== 'FLAT') {
    const confidence = Math.min(Math.abs(vel5m.velocity) / 500, 1.0);
    votes.push({ engine: 'velocity', direction: vel5m.direction === 'UP' ? 'YES' : 'NO', confidence: Math.max(confidence, 0.1) });
  }

  // Sentiment: multiplier deviation from 1 signals conviction
  if (sentimentMultiplier !== 1.0) {
    const confidence = Math.min(Math.abs(sentimentMultiplier - 1) * 2, 1.0);
    votes.push({ engine: 'sentiment', direction: sentimentMultiplier > 1 ? 'YES' : 'NO', confidence });
  }

  // Fundamental (includes B1 funding momentum + B2 news decay in compositeScore)
  if (fundamental.compositeScore !== 0) {
    const confidence = Math.min(Math.abs(fundamental.compositeScore) / 60, 1.0);
    votes.push({ engine: 'fundamental', direction: fundamental.compositeScore > 0 ? 'YES' : 'NO', confidence });
  }

  // Adaptive Kelly: votes in edge direction if edge clears the adaptive threshold
  if (Math.abs(edge) >= kellyMinEdge) {
    const confidence = Math.min(Math.abs(edge) * 10, 1.0);
    votes.push({ engine: 'kelly', direction: edge > 0 ? 'YES' : 'NO', confidence });
  }

  // Group A — Market microstructure ─────────────────────────────────────────

  // A2 Orderbook Depth: bid/ask imbalance
  if (ext.depth && ext.depth.signal !== 'NEUTRAL') {
    votes.push({ engine: 'depth', direction: ext.depth.signal === 'BUY_PRESSURE' ? 'YES' : 'NO', confidence: ext.depth.confidence });
  }

  // A3 Stasis Breakout: post-consolidation directional move
  if (ext.stasis?.breakoutDetected && ext.stasis.breakoutDirection) {
    const confidence = Math.min(ext.stasis.stasisMinutes / 8, 1.0);
    votes.push({ engine: 'stasis', direction: ext.stasis.breakoutDirection === 'UP' ? 'YES' : 'NO', confidence });
  }

  // A4 Entropy: DIRECTIONAL = ride trend, NOISY = fade
  if (ext.entropy && ext.entropy.regime !== 'NEUTRAL' && ext.entropy.confidence > 0.3 && velDir !== 'FLAT') {
    const dir = ext.entropy.regime === 'DIRECTIONAL' ? velYes : velNo;
    votes.push({ engine: 'entropy', direction: dir, confidence: ext.entropy.confidence });
  }

  // Group B — Macro & Session ───────────────────────────────────────────────

  // B1 Funding Momentum: separate vote on cascade liquidation risk
  if (ext.fundingMomentum && ext.fundingMomentum.signal !== 'NEUTRAL') {
    votes.push({ engine: 'funding_momentum', direction: ext.fundingMomentum.signal === 'BULLISH' ? 'YES' : 'NO', confidence: ext.fundingMomentum.confidence });
  }

  // B3 Session Clock: win-rate by UTC trading session
  if (ext.session && ext.session.signal !== 'NEUTRAL' && ext.session.confidence > 0 && velDir !== 'FLAT') {
    const dir = ext.session.signal === 'FAVORABLE' ? velYes : velNo;
    votes.push({ engine: 'session', direction: dir, confidence: ext.session.confidence });
  }

  // B4 Sentiment vs Price Divergence: contrarian signals
  if (ext.divergence?.divergenceActive && ext.divergence.direction) {
    votes.push({ engine: 'divergence', direction: ext.divergence.direction === 'CONTRARIAN_BULLISH' ? 'YES' : 'NO', confidence: ext.divergence.strength });
  }

  // Group C — Predictive ────────────────────────────────────────────────────

  // C3 Reversal Radar: jerk-based reversal detection
  if (ext.reversal?.reversalImminent && ext.reversal.signal) {
    const dir: 'YES' | 'NO' = ext.reversal.signal === 'REVERSE_SHORT' ? 'YES' : 'NO';
    votes.push({ engine: 'reversal', direction: dir, confidence: ext.reversal.confidence });
  }

  // C4 Bayesian Win Rate: posterior from historical outcomes
  if (ext.bayesian && ext.bayesian.signal !== 'NEUTRAL') {
    votes.push({ engine: 'bayesian', direction: ext.bayesian.signal === 'BULLISH' ? 'YES' : 'NO', confidence: ext.bayesian.confidence });
  }

  // Group E — Memory ────────────────────────────────────────────────────────

  // E2 Replay Similarity: similar past situations
  if (ext.replay && ext.replay.signal !== 'NEUTRAL' && ext.replay.sampleCount >= 2) {
    votes.push({ engine: 'replay', direction: ext.replay.signal === 'BULLISH' ? 'YES' : 'NO', confidence: ext.replay.voteConfidence });
  }

  return votes;
}

async function logSkippedTrade(
  deps: LoopDeps,
  orderbook: PolymarketOrderbook,
  direction: 'YES' | 'NO',
  reason: string,
  votes: EngineVote[],
  yesScore: number,
  noScore: number,
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('polyarb_trades').insert({
      user_id:              deps.config.userId,
      agent_id:             deps.config.agentId,
      order_id:             null,
      condition_id:         orderbook.conditionId,
      market_slug:          orderbook.marketSlug,
      outcome:              direction,
      side:                 'BUY',
      price:                orderbook.midPrice,
      size:                 0,
      size_usd:             0,
      fee_usd:              0,
      fee_rate_bps:         0,
      slippage_bps:         0,
      execution_latency_ms: 0,
      trade_type:           'SKIPPED',
      status:               'SKIPPED',
      raw_response:         { reason, yesScore, noScore, votes },
      executed_at:          new Date().toISOString(),
    });
  } catch {
    // Non-critical — don't let logging failures interrupt the loop
    return;
  }
}

/**
 * Edge-trigger insert into polyarb_event_log when EventDetector flips active.
 * Silent failure: missing table (pre-migration) or DB error → no-op.
 */
async function logEventToDb(deps: LoopDeps, event: EventState): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('polyarb_event_log').insert({
      agent_id:    deps.config.agentId,
      user_id:     deps.config.userId,
      event_type:  event.type,
      severity:    event.severity,
      detected_at: new Date(event.detectedAt).toISOString(),
      ttl_ms:      event.ttlMs,
      metadata:    { reason: event.reason },
    });
  } catch {
    // Silent — table may not exist yet, or transient DB error
  }
}

async function processMarket(
  deps: LoopDeps,
  metrics: LoopMetrics,
  orderbook: PolymarketOrderbook,
  btcSpotPrice: number,
  regime: RegimeState,
  crossMarket: CrossMarketSignal,
  fundamental: FundamentalSignal,
  eventState: EventState,
): Promise<void> {
  const { config, binanceFeed, positionTracker, orderManager, milestoneMap, adaptiveKelly, memoryBank, sentimentPulse,
          bayesianWinRate, sessionClock, replaySimilarity, calibrationTracker } = deps;
  const { params } = config;

  // ── Market scope filter — BTC + ETH updown-5m ──
  const prefixes = (process.env.POLYARB_MARKET_SLUG_PREFIXES ?? 'btc-updown-5m-,eth-updown-5m-').split(',');
  if (!prefixes.some(p => orderbook.marketSlug.startsWith(p.trim()))) return;

  // ── Window timing gate ──
  const windowInfo = extractWindowInfo(orderbook.marketSlug);
  if (!windowInfo) return;

  const now = Date.now();

  // Never enter within 60s of expiry
  if (isNearExpiry(windowInfo, now, 60_000)) return;

  // Already entered this specific window instance for this market
  if (deps.windowGate.hasEnteredWindow(orderbook.conditionId, orderbook.marketSlug)) return;

  // Entry allowed only during the first 60s of the 5-min window
  if (!isInEntryWindow(windowInfo, now, 60_000)) return;

  // Skip if already have an open position on this market
  const hasOpenPosition = positionTracker.open.some(p => p.conditionId === orderbook.conditionId);
  if (hasOpenPosition) return;

  // Max 2 simultaneous positions
  if (positionTracker.openCount >= 2) return;

  // ── Price history warmup — skip if insufficient data ──
  const priceHistory = binanceFeed.history;
  if (priceHistory.length < 10) return;

  // A3 Stasis Breakout — feed midPrice to circular buffer each tick
  updateStasisBuffer(orderbook.conditionId, orderbook.midPrice);

  // D1 Spoofing Detector — hard VETO if fake orders detected on this market
  const obHistory = deps.polymarketFeed.getOrderbookHistory(orderbook.conditionId);
  const spoofState = spoofingDetector.analyze(orderbook.conditionId, obHistory);
  if (spoofState.vetoActive) {
    console.log(`[loop] SPOOFING VETO ${orderbook.marketSlug} — skipping`);
    return;
  }

  // ── Belief volatility + fair price ──
  const sigma = estimateBeliefVolatility(priceHistory, orderbook.bidPrice, orderbook.askPrice);
  const baseFairPrice = computeFairPrice(orderbook.midPrice, sigma);

  // ── SP#1 Velocity Detector ──
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

  // ── Edge computation ──
  // E1 Calibration bias — correct systematic Polymarket over/under-estimation
  const calibration = calibrationTracker.getSignal(velocitySignal.symbol, orderbook.midPrice);
  const fairPrice = Math.max(0.01, Math.min(0.99, velocitySignal.adjustedFairProb + calibration.biasCorrection));
  let edge = computeEdge(fairPrice, orderbook.midPrice);

  // SP#4 Sentiment multiplier
  const tradingBullish = edge > 0;
  const sentimentMultiplier = sentimentPulse.getEdgeMultiplier(orderbook.conditionId, tradingBullish);
  edge *= sentimentMultiplier;

  // SP#6 Cross-market multiplier
  const marketVelDirection = velocitySignal.windows.find(w => w.label === '5m')?.direction;
  const primaryDir = marketVelDirection === 'UP' ? 'UP' : marketVelDirection === 'DOWN' ? 'DOWN' : null;
  if (primaryDir) {
    const marketCross = computeCrossMarketSignal(
      velocitySignal.symbol,
      primaryDir,
      binanceFeed.getTimestampedSamples('BTC'),
      binanceFeed.getTimestampedSamples('ETH'),
      binanceFeed.getTimestampedSamples('SOL'),
    );
    edge *= marketCross.edgeMultiplier;
  }

  // Fundamental multiplier
  const fundamentalMultiplier = compositeEdgeMultiplier(fundamental.compositeScore, tradingBullish);
  edge *= fundamentalMultiplier;

  // SP#3 Adaptive Kelly — keep state updated
  const kellyMinEdge = adaptiveKelly.getCurrentMinEdge(regime.agentMultiplier);

  // SP#2 Memory Bank — log only
  const memoryFilter = memoryBank.shouldFilter(velocitySignal, regime.regime);
  if (memoryFilter.filter) {
    console.log(`[loop] Memory Bank note: ${memoryFilter.reason}`);
  }

  // ── Level-150: Compute extended engine signals ──
  const vel5mDir = velocitySignal.windows.find(w => w.label === '5m')?.direction ?? 'FLAT';

  const depthSignal    = computeDepthSignal(orderbook.bidLevels ?? [], orderbook.askLevels ?? []);
  const stasisSignal   = computeStasisSignal(orderbook.conditionId);
  const entropySignal  = computeEntropySignal(priceHistory, vel5mDir as 'UP' | 'DOWN' | 'FLAT');
  const reversalSignal = computeReversalSignal(priceHistory);
  const divergenceSignal = computeDivergenceSignal(fundamental.components.fearGreed, priceHistory);
  const fundingMomSignal = deps.fundamentalEngine.fundingMomentum.get();

  // Async signals run in parallel — any failure returns null (engine omitted from pool)
  const [bayesianEstimate, sessionSignal, replaySignal] = await Promise.all([
    bayesianWinRate.estimate(velocitySignal, regime.regime).catch(() => null),
    sessionClock.getSignal(velocitySignal.symbol).catch(() => null),
    replaySimilarity.getSignal(
      velocitySignal.symbol,
      regime.regime,
      velocitySignal.huntStrength,
      new Date().getUTCHours(),
    ).catch(() => null),
  ]);

  const extSignals: ExtendedSignals = {
    depth: depthSignal,
    stasis: stasisSignal,
    entropy: entropySignal,
    reversal: reversalSignal,
    divergence: divergenceSignal,
    fundingMomentum: fundingMomSignal,
    session: sessionSignal,
    bayesian: bayesianEstimate,
    replay: replaySignal,
    velocityDirection: vel5mDir as 'UP' | 'DOWN' | 'FLAT',
  };

  // ── Engine Consensus Voting (Level 150 — up to 13 voters) ──
  const votes = computeEngineVotes(velocitySignal, sentimentMultiplier, fundamental, edge, kellyMinEdge, extSignals);

  // EVENT_TRIGGER synthetic voter — only when flagAggressive AND eventState.active.
  // Direction follows BTC velocity; confidence scales with severity.
  if (config.params.flagAggressive && eventState.active) {
    const velDir = extSignals.velocityDirection;
    if (velDir !== 'FLAT') {
      votes.push({
        engine: 'EVENT_TRIGGER',
        direction: velDir === 'UP' ? 'YES' : 'NO',
        confidence: 0.85 * eventState.severity,
      });
    }
  }

  const yesVotes = votes.filter(v => v.direction === 'YES');
  const noVotes  = votes.filter(v => v.direction === 'NO');
  const yesScore = yesVotes.reduce((s, v) => s + v.confidence, 0);
  const noScore  = noVotes.reduce((s, v) => s + v.confidence, 0);

  // C1 Adaptive Consensus: dynamic gate based on recent win rate + active voter pool
  const { winRate: recentWR, sampleCount: wrSamples } = computeRecentWinRate({
    wins: metrics.wins, losses: metrics.losses, totalTrades: metrics.totalTrades,
  });
  const consensusThresholds = computeConsensusThresholds(
    recentWR, wrSamples, votes.length, eventState, config.params.flagAggressive,
  );

  const buyYesMajority = yesScore > noScore
    && yesVotes.length >= consensusThresholds.minEngineVotes
    && (yesScore - noScore) >= consensusThresholds.minScoreMargin;
  const buyNoMajority = noScore > yesScore
    && noVotes.length >= consensusThresholds.minEngineVotes
    && (noScore - yesScore) >= consensusThresholds.minScoreMargin;

  if (!buyYesMajority && !buyNoMajority) {
    const direction = yesScore >= noScore ? 'YES' : 'NO' as const;
    void logSkippedTrade(deps, orderbook, direction, 'consensus_insufficient', votes, yesScore, noScore);
    return;
  }

  const buyYes = buyYesMajority;

  // ── Claim window SYNCHRONOUSLY — no await between here and placeOrder ──
  // Moved AFTER consensus gate: failed consensus no longer wastes the window.
  // Race-condition safety preserved: JS single-thread guarantees no interleave
  // between this line and the first await below.
  deps.windowGate.markEntered(orderbook.conditionId, orderbook.marketSlug);

  console.log(
    `[loop] ENGINE VOTES ${orderbook.marketSlug} YES=${yesScore.toFixed(2)}(${yesVotes.length}) NO=${noScore.toFixed(2)}(${noVotes.length})` +
    ` gate=${consensusThresholds.minEngineVotes}v/${consensusThresholds.minScoreMargin.toFixed(2)}m [${consensusThresholds.mode}]` +
    ` → ${buyYes ? 'YES' : 'NO'} edge=${edge.toFixed(4)}`
  );

  // ── Momentum (kept for entryReason metadata only) ──
  const momentum = calculateMomentumVector(
    priceHistory,
    params.loopIntervalMs / 1000,
    params.accelerationThreshold,
    params.jerkReversalThreshold,
  );

  // ── Kelly sizing — dynamic cap (10% NORMAL, up to 40% during event) ──
  const accountValue = metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd);
  const effectiveCap = effectiveKellyCap(params.maxKellyFraction, eventState, params.flagAggressive);
  const maxSizeUsd = accountValue * effectiveCap;
  const entryPrice = buyYes ? orderbook.askPrice : orderbook.bidPrice;

  // C2 Asymmetric Kelly — true binary reward/risk ratio b = (1-p)/p instead of fixed 1.5
  const kellyResult = asymmetricKelly(edge, entryPrice, effectiveCap, accountValue);
  const kelly = { ...kellyResult, leverage: 1.0 };

  const lossStreakMult = metrics.consecutiveLosses >= params.lossStreakThreshold
    ? params.lossStreakRiskReduction
    : 1.0;

  deps.cbState.reduceSizeNextTrade = false;
  const finalSize = Math.min(kelly.positionSizeUsd * lossStreakMult, maxSizeUsd);

  if (finalSize < 0.01) {
    void logSkippedTrade(deps, orderbook, buyYes ? 'YES' : 'NO', 'kelly_size_negligible', votes, yesScore, noScore);
    return;
  }

  // ── Execute order ──
  const market2 = deps.polymarketFeed.getMarkets().find(m => m.conditionId === orderbook.conditionId);
  const result = await orderManager.placeOrder({
    conditionId: orderbook.conditionId,
    yesTokenId: market2?.yesTokenId ?? orderbook.conditionId,
    noTokenId: market2?.noTokenId ?? '',
    marketSlug: orderbook.marketSlug,
    outcome: buyYes ? 'YES' : 'NO',
    side: 'BUY',
    price: entryPrice,
    sizeUsd: finalSize,
    negRisk: market2?.negRisk ?? true,
    agentId: config.agentId,
    userId: config.userId,
  });

  metrics.lastLatencyMs = result.executionLatencyMs;
  metrics.lastSlippage = result.slippageBps / 10_000;

  if (!result.success) {
    metrics.errorCount1h++;
    console.error(`[loop] Order failed (${orderbook.marketSlug}): ${result.error ?? 'unknown'}`);
    void logSkippedTrade(deps, orderbook, buyYes ? 'YES' : 'NO', `order_failed: ${result.error ?? 'unknown'}`, votes, yesScore, noScore);
    return;
  }

  // ── Open position + record in Memory Bank ──
  const position = await positionTracker.openPosition({
    marketSlug: orderbook.marketSlug,
    conditionId: orderbook.conditionId,
    outcome: buyYes ? 'YES' : 'NO',
    side: 'BUY',
    entryPrice: result.filledPrice,
    sizeUsd: finalSize,
    shares: result.filledSize,
    leverageUsed: kelly.leverage,
    entryReason: {
      pillar: 'consensus-voting-v3',
      edge,
      fairPrice,
      calibrationBias: calibration.biasCorrection,
      kellyFraction: kelly.fraction,
      kellyRewardRisk: kelly.rewardRiskRatio,
      momentum: momentum.signal,
      confidence: momentum.confidence,
      sigma,
      hestonLeverage: metrics.hestonState.leverage,
      regime: regime.regime,
      crossMarketStrength: crossMarket.strength,
      velocityHuntStrength: velocitySignal.huntStrength,
      sentimentMultiplier,
      fundamentalMultiplier,
      fundamentalScore: fundamental.compositeScore,
      consensusMode: consensusThresholds.mode,
      consensusGate: { votes: consensusThresholds.minEngineVotes, margin: consensusThresholds.minScoreMargin },
      depthSignal: extSignals.depth?.signal ?? null,
      stasisBreakout: extSignals.stasis?.breakoutDetected ?? false,
      entropyRegime: extSignals.entropy?.regime ?? null,
      reversalImminent: extSignals.reversal?.reversalImminent ?? false,
      fundingMomentumSignal: extSignals.fundingMomentum?.signal ?? null,
      sessionSignal: extSignals.session?.signal ?? null,
      bayesianPosterior: extSignals.bayesian?.posteriorMean ?? null,
      replaySamples: extSignals.replay?.sampleCount ?? 0,
      votes,
      yesScore,
      noScore,
      // Event-driven mode metadata
      eventType: eventState.active ? eventState.type : null,
      eventSeverity: eventState.active ? eventState.severity : 0,
      eventCap: effectiveCap,
      eventReason: eventState.active ? eventState.reason : null,
    },
  });

  if (position) {
    metrics.totalTrades++;
    memoryBank.recordEntry(position.id, velocitySignal, regime.regime, edge);
    void logCompliance(
      config.agentId,
      config.userId,
      'TRADE_ENTRY',
      position.id,
      'polyarb_positions',
      undefined,
      { price: result.filledPrice, size: finalSize, edge, kelly: kelly.fraction, regime: regime.regime, votes },
    );
  }
}

function recordTradeResult(metrics: LoopMetrics, pnlUsd: number, startingCapital: number): void {
  metrics.totalPnlUsd += pnlUsd;
  if (pnlUsd > 0) {
    metrics.wins++;
    metrics.consecutiveWins++;
    metrics.consecutiveLosses = 0;
  } else {
    metrics.losses++;
    metrics.consecutiveLosses++;
    metrics.consecutiveWins = 0;
  }
  const currentEquity = startingCapital + metrics.totalPnlUsd;
  if (currentEquity > metrics.peakEquity) metrics.peakEquity = currentEquity;
}

function updateTelemetry(deps: LoopDeps, metrics: LoopMetrics, tickStart: number): void {
  const { config, binanceFeed, polymarketFeed, positionTracker, telemetryWriter } = deps;
  const loopLatencyMs = Date.now() - tickStart;
  const equity = config.startingCapitalUsd + metrics.totalPnlUsd;
  const totalTrades = metrics.wins + metrics.losses;
  const maxDrawdown = metrics.peakEquity > 0
    ? ((metrics.peakEquity - equity) / metrics.peakEquity) * 100
    : 0;

  telemetryWriter.update({
    agentId: config.agentId,
    userId: config.userId,
    equityUsd: equity,
    availableBalanceUsd: metrics.realClobBalance ?? (equity - positionTracker.open.reduce((s, p) => s + p.sizeUsd, 0)),
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
    lastSignal: null,
    errorCount1h: metrics.errorCount1h,
    velocitySnapshot: metrics.lastVelocitySignals.length > 0 ? metrics.lastVelocitySignals : null,
    regimeSnapshot: metrics.lastRegime,
    adaptiveKellyState: deps.adaptiveKelly.getState(metrics.lastRegime?.agentMultiplier ?? 1),
    crossMarketSnapshot: metrics.lastCrossMarket,
    sentimentSnapshot: metrics.lastSentimentPulses.length > 0 ? metrics.lastSentimentPulses : null,
    memoryBankStats: deps.memoryBank.getStats().length > 0 ? deps.memoryBank.getStats() : null,
    eventState: metrics.lastEventState,
  });
}
