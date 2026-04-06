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

let loopInterval: ReturnType<typeof setInterval> | null = null;
let commandPollInterval: ReturnType<typeof setInterval> | null = null;
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
  const orderManager = new OrderManager(config.apiKey, config.apiSecret, config.apiPassphrase);
  const telemetryWriter = new TelemetryWriter();

  // 4. Load existing positions
  await positionTracker.loadFromDb();

  // 5. Start feeds
  binanceFeed.start();
  console.log('[main] Binance WS feed started');

  // Discover and track crypto markets
  const markets = await polymarketFeed.fetchCryptoMarkets();
  const activeMarkets = markets.filter(m => m.active);
  console.log(`[main] Found ${activeMarkets.length} active crypto markets`);

  if (activeMarkets.length > 0) {
    polymarketFeed.start(activeMarkets.map(m => m.conditionId));
    console.log('[main] Polymarket feed started');
  } else {
    console.warn('[main] No active crypto markets found — will retry in loop');
  }

  // 6. Start telemetry writer
  telemetryWriter.start();
  console.log('[main] Telemetry writer started');

  // 7. Initialize state
  const cbState = createCircuitBreakerState(config.startingCapitalUsd);
  const metrics = createLoopMetrics(config.startingCapitalUsd);

  const deps: LoopDeps = {
    config,
    binanceFeed,
    polymarketFeed,
    positionTracker,
    orderManager,
    telemetryWriter,
    cbState,
  };

  // 8. Start main trading loop
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

  // 9. Poll for command changes (start/stop/pause) every 5s
  commandPollInterval = setInterval(async () => {
    await pollCommands(config, deps, binanceFeed, polymarketFeed, telemetryWriter);
  }, 5_000);

  // 10. Graceful shutdown
  process.on('SIGINT', () => shutdown(config, binanceFeed, polymarketFeed, telemetryWriter));
  process.on('SIGTERM', () => shutdown(config, binanceFeed, polymarketFeed, telemetryWriter));

  console.log('[main] PolyArb engine running. Press Ctrl+C to stop.');
}

async function pollCommands(
  config: AgentConfig,
  deps: LoopDeps,
  binanceFeed: BinanceFeed,
  polymarketFeed: PolymarketFeed,
  telemetryWriter: TelemetryWriter
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
    shutdown(config, binanceFeed, polymarketFeed, telemetryWriter);
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
  telemetryWriter: TelemetryWriter
): void {
  console.log('[main] Shutting down...');
  running = false;

  if (loopInterval) { clearInterval(loopInterval); loopInterval = null; }
  if (commandPollInterval) { clearInterval(commandPollInterval); commandPollInterval = null; }

  binanceFeed.stop();
  polymarketFeed.stop();
  telemetryWriter.stop();

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
