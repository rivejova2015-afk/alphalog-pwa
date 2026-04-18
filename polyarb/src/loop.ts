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
import { calculateMomentumVector, isReversalImminent } from './math/momentum-physics.js';
import { aggressiveKelly, checkRiskReward } from './math/kelly-sizer.js';
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
    config.startingCapitalUsd + metrics.totalPnlUsd,
    metrics.consecutiveLosses,
    metrics.lastLatencyMs,
    metrics.lastSlippage,
    binanceFeed.isConnected,
    polymarketFeed.isConnected,
    params
  );

  if (cbEvents.length > 0) {
    void logCircuitBreakerEvents(config.agentId, config.userId, cbEvents);
    const closeAllEvent = cbEvents.find(e => e.actionTaken === 'CLOSE_ALL');
    if (closeAllEvent && positionTracker.openCount > 0) {
      const prices = new Map<string, number>();
      for (const ob of orderbooks) prices.set(ob.conditionId, ob.midPrice);
      await positionTracker.closeAll(prices);
    }
  }

  // tradingEnabled gate removed — super-aggressive mode, no agent-decided halts

  // ── Close timed-out positions ──
  const timedOut = positionTracker.getTimedOutPositions(300_000); // 5 min
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

  // ── Process each market ──
  for (const orderbook of orderbooks) {
    await processMarket(deps, metrics, orderbook, btcPrice.last, regime, crossMarket);
  }

  // ── Evolve Heston vol ──
  const dt = params.loopIntervalMs / 86_400_000;
  metrics.hestonState = hestonStep(metrics.hestonState.variance, dt, undefined, params.maxLeverage);

  drainEvents(cbState);
  updateTelemetry(deps, metrics, tickStart);
}

async function processMarket(
  deps: LoopDeps,
  metrics: LoopMetrics,
  orderbook: PolymarketOrderbook,
  btcSpotPrice: number,
  regime: RegimeState,
  crossMarket: CrossMarketSignal,
): Promise<void> {
  const { config, binanceFeed, positionTracker, orderManager, milestoneMap, adaptiveKelly, memoryBank, sentimentPulse } = deps;
  const { params } = config;

  const hasOpenPosition = positionTracker.open.some(p => p.conditionId === orderbook.conditionId);
  if (hasOpenPosition) return;

  // ── 2. Compute belief volatility ──
  const priceHistory = binanceFeed.history;
  if (priceHistory.length < 10) return;

  const sigma = estimateBeliefVolatility(priceHistory, orderbook.bidPrice, orderbook.askPrice);

  // ── 3. Compute base fair price ──
  const baseFairPrice = computeFairPrice(orderbook.midPrice, sigma);

  // ── SP#1 Velocity Detector — adjust fair price with momentum ──
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

  // Store for telemetry
  const vsIdx = metrics.lastVelocitySignals.findIndex(s => s.conditionId === orderbook.conditionId);
  if (vsIdx >= 0) metrics.lastVelocitySignals[vsIdx] = velocitySignal;
  else metrics.lastVelocitySignals.push(velocitySignal);

  // ── 4. Detect edge with velocity-adjusted fair price ──
  const fairPrice = velocitySignal.adjustedFairProb;
  let edge = computeEdge(fairPrice, orderbook.midPrice);

  // ── SP#4 Sentiment Pulse — apply edge multiplier ──
  const tradingBullish = edge > 0;
  const sentimentMultiplier = sentimentPulse.getEdgeMultiplier(orderbook.conditionId, tradingBullish);
  edge *= sentimentMultiplier;

  // ── SP#6 Cross-Market — apply confirmation multiplier ──
  // Re-compute with correct direction for this market's velocity signal
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

  // ── SP#3 Adaptive Kelly state — still track but don't filter ──
  adaptiveKelly.getCurrentMinEdge(regime.agentMultiplier); // keep state updated

  // ── SP#2 Memory Bank — log only, no filter ──
  const memoryFilter = memoryBank.shouldFilter(velocitySignal, regime.regime);
  if (memoryFilter.filter) {
    console.log(`[loop] Memory (ignored, super-aggressive): ${memoryFilter.reason}`);
  }

  // ── 5. Momentum physics ──
  const momentum = calculateMomentumVector(
    priceHistory,
    params.loopIntervalMs / 1000,
    params.accelerationThreshold,
    params.jerkReversalThreshold,
  );

  // HOLD + reversal gates removed — super-aggressive mode

  // Determine direction — use edge alone (momentum signal no longer gates)
  const buyYes = edge > 0;
  const buyNo = edge < 0;
  if (!buyYes && !buyNo) return;

  // ── 6. Kelly sizing ──
  const accountValue = config.startingCapitalUsd + metrics.totalPnlUsd;
  const entryPrice = buyYes ? orderbook.askPrice : orderbook.bidPrice;

  const kelly = aggressiveKelly(
    edge,
    sigma,
    metrics.consecutiveWins,
    accountValue,
    entryPrice,
    fairPrice,
    params.maxKellyFraction,
    Math.min(params.maxLeverage, metrics.hestonState.leverage),
    params.winStreakBonus,
  );

  // Consecutive loss risk reduction: after N losses, reduce Kelly until recovery
  const lossStreakMult = metrics.consecutiveLosses >= params.lossStreakThreshold
    ? params.lossStreakRiskReduction
    : 1.0;

  const sizeMultiplier = (deps.cbState.reduceSizeNextTrade ? 0.8 : 1.0) * lossStreakMult;
  deps.cbState.reduceSizeNextTrade = false;

  // Enforce minimum position size ($5) — Kelly may produce tiny sizes with small account
  const finalSize = Math.max(params.minPositionSizeUsd, kelly.positionSizeUsd * sizeMultiplier);

  // risk/reward gate removed — super-aggressive mode

  // ── 8. Execute order ──
  const market2 = deps.polymarketFeed.getMarkets().find(m => m.conditionId === orderbook.conditionId);
  const result = await orderManager.placeOrder({
    conditionId: orderbook.conditionId,
    yesTokenId: market2?.yesTokenId ?? orderbook.conditionId,
    marketSlug: orderbook.marketSlug,
    outcome: buyYes ? 'YES' : 'NO',
    side: 'BUY',
    price: entryPrice,
    sizeUsd: finalSize,
    agentId: config.agentId,
    userId: config.userId,
  });

  metrics.lastLatencyMs = result.executionLatencyMs;
  metrics.lastSlippage = result.slippageBps / 10_000;

  if (!result.success) {
    metrics.errorCount1h++;
    console.error(`[loop] Order failed (${orderbook.marketSlug}): ${result.error ?? 'unknown'}`);
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
      pillar: 'edge-only-super-aggressive',
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
    },
  });

  if (position) {
    metrics.totalTrades++;
    // SP#2: record entry in Memory Bank
    memoryBank.recordEntry(position.id, velocitySignal, regime.regime, edge);
    void logCompliance(
      config.agentId,
      config.userId,
      'TRADE_ENTRY',
      position.id,
      'polyarb_positions',
      undefined,
      { price: result.filledPrice, size: finalSize, edge, kelly: kelly.fraction, regime: regime.regime },
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
    availableBalanceUsd: equity - positionTracker.open.reduce((s, p) => s + p.sizeUsd, 0),
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
