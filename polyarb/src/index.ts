/**
 * PolyArb-Crypto-Latency-Physics-v1
 *
 * Entry point: loads config, starts feeds, runs main trading loop.
 * Designed for persistent process on Fly.io.
 */

import { loadAgentConfig, type AgentConfig } from './config.js';
import { getSupabase } from './supabase.js';
import { BinanceFeed } from './feeds/binance-ws.js';
import { PolymarketFeed } from './feeds/polymarket-ws.js';
import { PositionTracker } from './trading/position-tracker.js';
import { OrderManager } from './trading/order-manager.js';
import { TelemetryWriter } from './telemetry/writer.js';
import { logCompliance } from './telemetry/compliance.js';
import { createCircuitBreakerState } from './trading/circuit-breaker.js';
import { tradingTick, createLoopMetrics, type LoopDeps } from './loop.js';
import { sweepUnsettledPositions, redeemPendingWins } from './skills/settlement-engine.js';
import { CtfRedeemer } from './trading/ctf-redeemer.js';
import { parseMilestonePrice } from './skills/velocity-detector.js';
import { AdaptiveKelly } from './skills/adaptive-kelly.js';
import { MemoryBank } from './skills/memory-bank.js';
import { SentimentPulseTracker } from './skills/sentiment-pulse.js';
import { FundamentalEngine } from './analysis/fundamental-engine.js';
import { WindowGate } from './trading/window-gate.js';
import { BayesianWinRate } from './skills/bayesian-winrate.js';
import { SessionClock } from './skills/session-clock.js';
import { ReplaySimilarity } from './skills/replay-similarity.js';
import { CalibrationTracker } from './skills/calibration-tracker.js';

let loopInterval: ReturnType<typeof setInterval> | null = null;
let commandPollInterval: ReturnType<typeof setInterval> | null = null;
let marketRefreshInterval: ReturnType<typeof setInterval> | null = null;
let balancePollInterval: ReturnType<typeof setInterval> | null = null;
let running = false;

async function main(): Promise<void> {
  console.log('=== PolyArb-Crypto-Latency-Physics-v1 ===');
  console.log(`Starting at ${new Date().toISOString()}`);

  // 1. Load agent config from Supabase
  const config = await loadAgentConfig();
  console.log(`Agent: ${config.name} (${config.agentId})`);
  console.log(`Starting capital: $${config.startingCapitalUsd}`);

  if (!config.apiKey || !config.apiSecret || !config.apiPassphrase) {
    console.error('Polymarket API credentials not configured. Set them in the dashboard.');
    process.exit(1);
  }

  if (config.dryRun) {
    console.log('[main] *** DRY_RUN mode active — no real orders will be placed ***');
  } else if (!config.walletPrivateKey && (!config.walletAddress || !config.apiSecret)) {
    console.error('[main] LIVE mode requires either POLYARB_WALLET_PRIVATE_KEY or a valid walletAddress + apiSecret (L2 proxy signing)');
    process.exit(1);
  } else if (!config.walletPrivateKey) {
    console.log('[main] LIVE mode — using POLY_PROXY signing (L2 api_secret)');
  }

  // 2. Set agent status to RUNNING
  const supabase = getSupabase();
  await supabase
    .from('polyarb_agents')
    .update({ status: 'RUNNING', last_heartbeat_at: new Date().toISOString() })
    .eq('id', config.agentId);

  await logCompliance(config.agentId, config.userId, 'AGENT_START');

  // 3. Initialize components
  const binanceFeed = new BinanceFeed();
  const polymarketFeed = new PolymarketFeed();
  const positionTracker = new PositionTracker(config.agentId, config.userId);
  const orderManager = new OrderManager(config.apiKey, config.apiSecret, config.apiPassphrase, config.walletPrivateKey, config.dryRun, config.walletAddress);
  const telemetryWriter = new TelemetryWriter();
  const ctfRedeemer = new CtfRedeemer(config.walletPrivateKey, config.dryRun);

  // 4. Load existing positions
  await positionTracker.loadFromDb();

  // Liquidar P&L en DB para posiciones pasadas sin resultado confirmado
  await sweepUnsettledPositions(supabase);

  // Redimir tokens ganadores on-chain vía NegRiskAdapter (requiere MATIC en wallet)
  await redeemPendingWins(supabase, ctfRedeemer);

  // Startup balance check — shows CLOB-approved + on-chain wallet balance
  const balances = await orderManager.fetchOnChainBalance();
  console.log(`[main] CLOB balance:   ${balances.clob   !== null ? `$${balances.clob.toFixed(4)} USDC`   : 'N/A'}`);
  console.log(`[main] Wallet balance: ${balances.wallet !== null ? `$${balances.wallet.toFixed(4)} USDC` : 'N/A'}`);
  console.log(`[main] Total balance:  ${balances.total  !== null ? `$${balances.total.toFixed(4)} USDC`  : 'N/A'}`);


  // 5. Start feeds
  binanceFeed.start();
  console.log('[main] Binance WS feed started');

  // Discover and track crypto markets
  const markets = await polymarketFeed.fetchCryptoMarkets();
  const activeMarkets = markets.filter(m => m.active);
  console.log(`[main] Found ${activeMarkets.length} active crypto markets`);

  // Build milestone price map (conditionId → parsed milestone price)
  const milestoneMap = new Map<string, number | null>();
  for (const market of activeMarkets) {
    milestoneMap.set(market.conditionId, parseMilestonePrice(market.question));
  }
  console.log(`[main] Parsed milestones: ${[...milestoneMap.entries()].filter(([,v]) => v !== null).length}/${activeMarkets.length} markets`);

  if (activeMarkets.length > 0) {
    polymarketFeed.start(activeMarkets.map(m => m.conditionId));
    console.log('[main] Polymarket feed started');
  } else {
    console.warn('[main] No active crypto markets found — will retry in loop');
  }

  // 6. Start telemetry writer
  telemetryWriter.start();
  console.log('[main] Telemetry writer started');

  // 7. Initialize state + superpowers
  const cbState = createCircuitBreakerState(config.startingCapitalUsd);
  const metrics = createLoopMetrics(config.startingCapitalUsd);

  // SP#3 Adaptive Kelly
  const adaptiveKelly = new AdaptiveKelly(config.params.minEdgePercent);

  // SP#2 Memory Bank — load historical signal outcomes from DB
  const memoryBank = new MemoryBank(config.agentId, config.userId);
  await memoryBank.loadFromDb();
  console.log('[main] Memory Bank loaded');

  // SP#4 Sentiment Pulse tracker
  const sentimentPulse = new SentimentPulseTracker();

  // Fundamental Analysis Engine — starts background refresh loops
  const fundamentalEngine = new FundamentalEngine();
  fundamentalEngine.start();

  // Wire Sentiment Pulse into Polymarket feed (hook on every orderbook poll)
  polymarketFeed.onOrderbookUpdate = (conditionId, bidSize, askSize, bidPrice, askPrice) => {
    sentimentPulse.record(conditionId, bidSize, askSize, bidPrice, askPrice);
  };

  const windowGate = new WindowGate();

  // Level-150 engines
  const bayesianWinRate  = new BayesianWinRate();
  const sessionClock     = new SessionClock();
  const replaySimilarity = new ReplaySimilarity(config.agentId);
  const calibrationTracker = new CalibrationTracker(config.agentId, config.userId);

  // Load calibration bias history from DB (non-blocking — bot runs with empty data if it fails)
  void calibrationTracker.loadFromDb().then(() => {
    console.log('[main] Calibration Tracker loaded');
  }).catch((err: unknown) => {
    console.warn('[main] Calibration Tracker load failed (non-critical):', err);
  });

  const deps: LoopDeps = {
    config,
    binanceFeed,
    polymarketFeed,
    positionTracker,
    orderManager,
    telemetryWriter,
    cbState,
    milestoneMap,
    adaptiveKelly,
    memoryBank,
    sentimentPulse,
    fundamentalEngine,
    windowGate,
    bayesianWinRate,
    sessionClock,
    replaySimilarity,
    calibrationTracker,
  };

  // 8. Refresh crypto market list every 5 min — catches new short-term markets
  const refreshMarkets = async () => {
    try {
      const fresh = await polymarketFeed.fetchCryptoMarkets();
      const freshActive = fresh.filter(m => m.active);
      if (freshActive.length === 0) return;
      // Add newly discovered conditionIds to tracking
      const currentIds = new Set(deps.milestoneMap.keys());
      for (const m of freshActive) {
        if (!currentIds.has(m.conditionId)) {
          deps.milestoneMap.set(m.conditionId, parseMilestonePrice(m.question));
          console.log(`[markets] New market discovered: ${m.question.slice(0, 60)}`);
        }
      }
      polymarketFeed.start(freshActive.map(m => m.conditionId));
    } catch (err) {
      console.error('[markets] Refresh error:', err);
    }
  };
  marketRefreshInterval = setInterval(() => void refreshMarkets(), 5 * 60_000);

  // Poll real balance every 30s (CLOB + on-chain wallet) — stored in metrics for TelemetryWriter
  const pollRealBalance = async () => {
    const { clob, wallet, total } = await orderManager.fetchOnChainBalance();
    if (total !== null) {
      metrics.realClobBalance = total;
      console.log(`[balance] CLOB=$${(clob ?? 0).toFixed(4)} Wallet=$${(wallet ?? 0).toFixed(4)} Total=$${total.toFixed(4)} USDC`);
    }
  };
  void pollRealBalance();
  balancePollInterval = setInterval(() => void pollRealBalance(), 30_000);

  // 9. Start main trading loop
  running = true;
  console.log(`[main] Trading loop starting (${config.params.loopIntervalMs}ms interval)`);

  loopInterval = setInterval(async () => {
    if (!running) return;
    try {
      await tradingTick(deps, metrics);
    } catch (err) {
      console.error('[main] Loop error:', err);
      metrics.errorCount1h++;
    }
  }, config.params.loopIntervalMs);

  // 10. Poll for command changes (start/stop/pause) every 5s
  commandPollInterval = setInterval(async () => {
    await pollCommands(config, deps, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine);
  }, 5_000);

  // 10. Graceful shutdown
  process.on('SIGINT', () => shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine));
  process.on('SIGTERM', () => shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine));

  console.log('[main] PolyArb engine running. Press Ctrl+C to stop.');
}

async function pollCommands(
  config: AgentConfig,
  deps: LoopDeps,
  binanceFeed: BinanceFeed,
  polymarketFeed: PolymarketFeed,
  telemetryWriter: TelemetryWriter,
  fundamentalEngine: FundamentalEngine,
): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('polyarb_agents')
    .select('status')
    .eq('id', config.agentId)
    .single();

  if (!data) return;

  const status = data.status as string;

  if (status === 'STOPPED' && running) {
    console.log('[main] Received STOP command');
    running = false;
    deps.cbState.tradingEnabled = false;
    shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine);
  } else if (status === 'PAUSED' && deps.cbState.tradingEnabled) {
    console.log('[main] Received PAUSE command');
    deps.cbState.tradingEnabled = false;
    void logCompliance(config.agentId, config.userId, 'AGENT_PAUSE');
  } else if (status === 'RUNNING' && !deps.cbState.tradingEnabled && running) {
    console.log('[main] Received RESUME command');
    deps.cbState.tradingEnabled = true;
    deps.cbState.pausedUntil = null;
    void logCompliance(config.agentId, config.userId, 'AGENT_RESUME');
  }
}

function shutdown(
  config: AgentConfig,
  binanceFeed: BinanceFeed,
  polymarketFeed: PolymarketFeed,
  telemetryWriter: TelemetryWriter,
  fundamentalEngine: FundamentalEngine,
): void {
  console.log('[main] Shutting down...');
  running = false;

  if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
  if (commandPollInterval) { clearInterval(commandPollInterval); commandPollInterval = null; }
  if (marketRefreshInterval) { clearInterval(marketRefreshInterval); marketRefreshInterval = null; }
  if (balancePollInterval) { clearInterval(balancePollInterval); balancePollInterval = null; }

  binanceFeed.stop();
  polymarketFeed.stop();
  telemetryWriter.stop();
  fundamentalEngine.stop();

  // Update status
  const supabase = getSupabase();
  void supabase
    .from('polyarb_agents')
    .update({ status: 'STOPPED' })
    .eq('id', config.agentId);

  void logCompliance(config.agentId, config.userId, 'AGENT_STOP');

  console.log('[main] Shutdown complete');
  setTimeout(() => process.exit(0), 2_000);
}

// Run
main().catch((err) => {
  console.error('[main] Fatal error:', err);
  process.exit(1);
});
