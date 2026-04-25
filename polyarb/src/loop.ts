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
  type CircuitBreakerState,
} from './trading/circuit-breaker.js';
import { logCircuitBreakerEvents, logCompliance } from './telemetry/compliance.js';
import { estimateBeliefVolatility, computeFairPrice, computeEdge } from './math/jump-diffusion.js';
import { calculateMomentumVector } from './math/momentum-physics.js';
import { aggressiveKelly } from './math/kelly-sizer.js';
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
  };
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
  const cbEvents = checkCircuitBreakers(
    cbState,
    metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd),
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

  // ── Process each market ──
  for (const orderbook of orderbooks) {
    await processMarket(deps, metrics, orderbook, btcPrice.last, regime, crossMarket, fundamental);
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

function computeEngineVotes(
  velocitySignal: VelocitySignal,
  sentimentMultiplier: number,
  fundamental: FundamentalSignal,
  edge: number,
  kellyMinEdge: number,
): EngineVote[] {
  const votes: EngineVote[] = [];

  // Velocity: 5m window direction — strength derived from normalised velocity magnitude
  const vel5m = velocitySignal.windows.find(w => w.label === '5m');
  if (vel5m && vel5m.direction !== 'FLAT') {
    // Normalize velocity to confidence (0-1), cap at 1
    const confidence = Math.min(Math.abs(vel5m.velocity) / 500, 1.0);
    votes.push({ engine: 'velocity', direction: vel5m.direction === 'UP' ? 'YES' : 'NO', confidence: Math.max(confidence, 0.1) });
  }

  // Sentiment: multiplier deviation from 1 signals conviction
  if (sentimentMultiplier !== 1.0) {
    const confidence = Math.min(Math.abs(sentimentMultiplier - 1) * 2, 1.0);
    votes.push({ engine: 'sentiment', direction: sentimentMultiplier > 1 ? 'YES' : 'NO', confidence });
  }

  // Fundamental: compositeScore range is ±95; normalise to 0-1 confidence
  if (fundamental.compositeScore !== 0) {
    const confidence = Math.min(Math.abs(fundamental.compositeScore) / 60, 1.0);
    votes.push({ engine: 'fundamental', direction: fundamental.compositeScore > 0 ? 'YES' : 'NO', confidence });
  }

  // Adaptive Kelly: votes in edge direction if edge clears the adaptive threshold
  if (Math.abs(edge) >= kellyMinEdge) {
    const confidence = Math.min(Math.abs(edge) * 10, 1.0);
    votes.push({ engine: 'kelly', direction: edge > 0 ? 'YES' : 'NO', confidence });
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
): Promise<void> {
  const { config, binanceFeed, positionTracker, orderManager, milestoneMap, adaptiveKelly, memoryBank, sentimentPulse } = deps;
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
  const fairPrice = velocitySignal.adjustedFairProb;
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

  // ── 4-Engine Consensus Voting ──
  const votes = computeEngineVotes(velocitySignal, sentimentMultiplier, fundamental, edge, kellyMinEdge);
  const yesScore = votes.filter(v => v.direction === 'YES').reduce((s, v) => s + v.confidence, 0);
  const noScore  = votes.filter(v => v.direction === 'NO').reduce((s, v) => s + v.confidence, 0);

  let buyYes: boolean;
  let forcedEntry = false;

  if (yesScore > noScore) {
    buyYes = true;
  } else if (noScore > yesScore) {
    buyYes = false;
  } else {
    // Tie or no votes — Fundamental Engine as tiebreaker
    buyYes = fundamental.compositeScore >= 0;
    forcedEntry = true;
  }

  console.log(
    `[loop] ${orderbook.marketSlug} votes YES=${yesScore.toFixed(2)} NO=${noScore.toFixed(2)}` +
    ` → ${buyYes ? 'YES' : 'NO'}${forcedEntry ? ' (forced/tiebreak)' : ''} edge=${edge.toFixed(4)}`
  );

  // ── Momentum (kept for entryReason metadata only) ──
  const momentum = calculateMomentumVector(
    priceHistory,
    params.loopIntervalMs / 1000,
    params.accelerationThreshold,
    params.jerkReversalThreshold,
  );

  // ── Kelly sizing — capped at 10% of balance ──
  const accountValue = metrics.realClobBalance ?? (config.startingCapitalUsd + metrics.totalPnlUsd);
  const maxSizeUsd = accountValue * params.maxKellyFraction; // 10% cap
  const entryPrice = buyYes ? orderbook.askPrice : orderbook.bidPrice;

  const kelly = aggressiveKelly(
    edge,
    sigma,
    metrics.consecutiveWins,
    accountValue,
    entryPrice,
    fairPrice,
    params.maxKellyFraction,
    1.0, // no leverage in binary markets
    1.0, // no win-streak bonus
  );

  const lossStreakMult = metrics.consecutiveLosses >= params.lossStreakThreshold
    ? params.lossStreakRiskReduction
    : 1.0;

  deps.cbState.reduceSizeNextTrade = false;
  const finalSize = Math.min(kelly.positionSizeUsd * lossStreakMult, maxSizeUsd);

  if (finalSize < 0.01) {
    void logSkippedTrade(deps, orderbook, buyYes ? 'YES' : 'NO', 'kelly_size_negligible', votes, yesScore, noScore);
    deps.windowGate.markEntered(orderbook.conditionId, orderbook.marketSlug);
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

  // Mark window as entered regardless of order success — one attempt per window
  deps.windowGate.markEntered(orderbook.conditionId, orderbook.marketSlug);

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
      pillar: 'consensus-voting-v2',
      edge,
      fairPrice,
      kellyFraction: kelly.fraction,
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
      votes,
      yesScore,
      noScore,
      forcedEntry,
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
      { price: result.filledPrice, size: finalSize, edge, kelly: kelly.fraction, regime: regime.regime, votes, forcedEntry },
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
  });
}
