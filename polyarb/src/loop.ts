/**
 * Main Trading Loop — runs every 250ms
 *
 * Pipeline per tick:
 * 1. Read feeds (BTC price + Polymarket orderbook)
 * 2. Compute belief volatility
 * 3. Compute fair price (jump-diffusion)
 * 4. Detect edge
 * 5. Compute momentum physics
 * 6. Kelly sizing
 * 7. Risk/reward check
 * 8. Execute order
 * 9. Check circuit breakers
 * 10. Update telemetry
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

export interface LoopDeps {
  config: AgentConfig;
  binanceFeed: BinanceFeed;
  polymarketFeed: PolymarketFeed;
  positionTracker: PositionTracker;
  orderManager: OrderManager;
  telemetryWriter: TelemetryWriter;
  cbState: CircuitBreakerState;
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
    // No data yet — update telemetry but skip trading
    updateTelemetry(deps, metrics, tickStart);
    return;
  }

  // ── Check circuit breakers first ──
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

    // If CLOSE_ALL action triggered, liquidate
    const closeAllEvent = cbEvents.find(e => e.actionTaken === 'CLOSE_ALL');
    if (closeAllEvent && positionTracker.openCount > 0) {
      const prices = new Map<string, number>();
      for (const ob of orderbooks) {
        prices.set(ob.conditionId, ob.midPrice);
      }
      await positionTracker.closeAll(prices);
    }
  }

  if (!cbState.tradingEnabled) {
    updateTelemetry(deps, metrics, tickStart);
    return;
  }

  // ── Close timed-out positions ──
  const timedOut = positionTracker.getTimedOutPositions(300_000); // 5 min
  for (const pos of timedOut) {
    const ob = polymarketFeed.getOrderbook(pos.conditionId);
    const exitPrice = ob?.midPrice ?? pos.entryPrice;
    const closed = await positionTracker.closePosition(pos.id, exitPrice, 'timeout');
    if (closed) {
      recordTradeResult(metrics, closed.pnlUsd, config.startingCapitalUsd);
      void logCompliance(config.agentId, config.userId, 'TRADE_EXIT', pos.id, 'polyarb_positions');
    }
  }

  // ── Process each market ──
  for (const orderbook of orderbooks) {
    await processMarket(deps, metrics, orderbook, btcPrice.last);
  }

  // ── Evolve Heston vol ──
  const dt = params.loopIntervalMs / 86_400_000; // fraction of day
  metrics.hestonState = hestonStep(metrics.hestonState.variance, dt, undefined, params.maxLeverage);

  // ── Drain circuit breaker events ──
  drainEvents(cbState);

  // ── Update telemetry ──
  updateTelemetry(deps, metrics, tickStart);
}

async function processMarket(
  deps: LoopDeps,
  metrics: LoopMetrics,
  orderbook: PolymarketOrderbook,
  btcSpotPrice: number
): Promise<void> {
  const { config, binanceFeed, positionTracker, orderManager } = deps;
  const { params } = config;

  // Already have an open position in this market? Skip new entries
  const hasOpenPosition = positionTracker.open.some(
    p => p.conditionId === orderbook.conditionId
  );
  if (hasOpenPosition) return;

  // ── 2. Compute belief volatility ──
  const priceHistory = binanceFeed.history;
  if (priceHistory.length < 10) return; // not enough data

  const sigma = estimateBeliefVolatility(
    priceHistory,
    orderbook.bidPrice,
    orderbook.askPrice
  );

  // ── 3. Compute fair price ──
  const fairPrice = computeFairPrice(orderbook.midPrice, sigma);

  // ── 4. Detect edge ──
  const edge = computeEdge(fairPrice, orderbook.midPrice);
  if (Math.abs(edge) < params.minEdgePercent) return;

  // ── 5. Momentum physics ──
  // Convert Polymarket orderbook history to price array
  // For now, use the BTC price history as proxy signal
  const momentum = calculateMomentumVector(
    priceHistory,
    params.loopIntervalMs / 1000,
    params.accelerationThreshold,
    params.jerkReversalThreshold
  );

  if (momentum.signal === 'HOLD') return;
  if (isReversalImminent(momentum.jerk, params.jerkReversalThreshold)) return;

  // Determine direction
  const buyYes = edge > 0 && momentum.signal === 'BUY';
  const buyNo = edge < 0 && momentum.signal === 'SELL';
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
    params.winStreakBonus
  );

  // Apply slippage reduction if flagged
  const sizeMultiplier = deps.cbState.reduceSizeNextTrade ? 0.8 : 1.0;
  deps.cbState.reduceSizeNextTrade = false;
  const finalSize = kelly.positionSizeUsd * sizeMultiplier;

  // ── 7. Risk/reward check ──
  if (!checkRiskReward(entryPrice, kelly.stopLoss, kelly.takeProfit, params.minRiskReward)) return;

  // ── 8. Execute order ──
  const result = await orderManager.placeOrder({
    conditionId: orderbook.conditionId,
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
    return;
  }

  // Open position
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
      pillar: 'jump-diffusion + momentum',
      edge,
      fairPrice,
      kellyFraction: kelly.fraction,
      momentum: momentum.signal,
      confidence: momentum.confidence,
      sigma,
      hestonLeverage: metrics.hestonState.leverage,
    },
  });

  if (position) {
    metrics.totalTrades++;
    void logCompliance(
      config.agentId,
      config.userId,
      'TRADE_ENTRY',
      position.id,
      'polyarb_positions',
      undefined,
      { price: result.filledPrice, size: finalSize, edge, kelly: kelly.fraction }
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
  if (currentEquity > metrics.peakEquity) {
    metrics.peakEquity = currentEquity;
  }
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
    profitFactor: null, // computed separately
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
  });
}
