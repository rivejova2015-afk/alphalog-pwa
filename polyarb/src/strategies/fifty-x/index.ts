/**
 * PolyArb 500x — parallel strategy entry point.
 *
 * Loads its own agent row (different `agent_id`) and runs `tradingTick50x`
 * which replaces the 14-engine consensus with the 5-layer validator + ENTER/SCALP
 * decision tier and adds three strategy-only mechanics: cascade entries,
 * session-aware Kelly multipliers, and an automated Day-10 reliability gate.
 * Production engine (`src/index.ts`) is untouched.
 */

import { loadFiftyXAgentConfig, type FiftyXAgentConfig } from './config-50x.js';
import { getSupabase } from '../../supabase.js';
import { BinanceFeed } from '../../feeds/binance-ws.js';
import { BinancePerpFeed } from '../../feeds/binance-perp-ws.js';
import { DeribitIVFeed } from '../../feeds/deribit-iv-ws.js';
import { CoinbaseFeed } from '../../feeds/coinbase-ws.js';
import { PolymarketFeed } from '../../feeds/polymarket-ws.js';
import { AdaptiveKelly } from '../../skills/adaptive-kelly.js';
import { BayesianWinRate } from '../../skills/bayesian-winrate.js';
import { MemoryBank } from '../../skills/memory-bank.js';
import { SessionClock } from '../../skills/session-clock.js';
import { PositionTracker } from '../../trading/position-tracker.js';
import { OrderManager } from '../../trading/order-manager.js';
import { TelemetryWriter } from '../../telemetry/writer.js';
import { logCompliance } from '../../telemetry/compliance.js';
import { createCircuitBreakerState } from '../../trading/circuit-breaker.js';
import { sweepUnsettledPositions, redeemPendingWins } from '../../skills/settlement-engine.js';
import { CtfRedeemer } from '../../trading/ctf-redeemer.js';
import { parseMilestonePrice } from '../../skills/velocity-detector.js';
import { FundamentalEngine } from '../../analysis/fundamental-engine.js';
import { WindowGate } from '../../trading/window-gate.js';
import { CalibrationTracker } from '../../skills/calibration-tracker.js';
import { createStatCBState } from '../../trading/statistical-circuit-breaker.js';
import { EventDetector } from '../../skills/event-detector.js';
import { MacroEventFeed } from '../../feeds/macro-event-feed.js';

import {
  tradingTick50x,
  createLoopMetrics50x,
  KellyAdjuster500xOptionB,
  resolveEngineV2Mode,
  type LoopDeps50x,
} from './loop-50x.js';
import { CascadeState } from './cascade-manager.js';
import { TradeScheduler } from './scheduler.js';
import { RealtimeMetrics } from './observability/realtime-metrics.js';
import { AnomalyDetector } from './observability/anomaly-detector.js';
import { Day10Validator } from './observability/day-10-validator.js';

let loopTimeout: ReturnType<typeof setTimeout> | null = null;
let commandPollInterval: ReturnType<typeof setInterval> | null = null;
let marketRefreshInterval: ReturnType<typeof setInterval> | null = null;
let balancePollInterval: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastSeenStatus: string | null = null;

async function main(): Promise<void> {
  console.log('[500x] === PolyArb 500x — 24/7 session-aware Kelly 2.5× ===');
  console.log(`[500x] Starting at ${new Date().toISOString()}`);

  const config = await loadFiftyXAgentConfig();
  console.log(`[500x] Agent: ${config.name} (${config.agentId})`);
  console.log(`[500x] Starting capital: $${config.startingCapitalUsd}`);
  console.log(
    `[500x] params:` +
    ` enter=${config.params.enterMinGap}/${config.params.enterMinConfidence}/${config.params.enterMinValidatedCount}layers` +
    ` scalp=${config.params.scalpMinGap}/${config.params.scalpMinConfidence}/${config.params.scalpMinValidatedCount}layers` +
    ` scalpKMult=${config.params.scalpKellyMultiplier}` +
    ` cascade(trigger=${config.params.cascadeTriggerPnl} decay=${config.params.cascadeKellyDecay} maxLvls=${config.params.cascadeMaxLevels})` +
    ` maxKelly=${config.params.maxKellyFraction}` +
    ` maxKellyEvent=${config.params.maxKellyFractionEvent}`,
  );
  console.log('[500x] session-multipliers AGGRESSIVE = {OVERLAP:2.5, LDN:1.9, NY:2.2, ASIA:1.0}');
  console.log('[500x] session-multipliers SAFE       = {OVERLAP:2.0, LDN:1.5, NY:1.8, ASIA:0.8}');
  console.log('[500x] day-10 gate: winRate>=85% EV>=2.5% PF>=2.0 sharpe>=1.2(warn)');
  console.log('[500x] guardrails ACTIVE: dailyDD=-90%, hourlyDD=-50%, balance-gate=$1 (skips CB until first real reading)');
  console.log('[500x] safety nets KEPT (statistical-CB, regime-detector, event-detector, asymmetric-kelly clamp at maxKellyFractionEvent=0.40)');

  if (!config.apiKey || !config.apiSecret || !config.apiPassphrase) {
    console.error('[500x] Polymarket API credentials not configured. Set them in the dashboard.');
    process.exit(1);
  }

  if (config.dryRun) {
    console.log('[500x] *** DRY_RUN mode active — no real orders will be placed ***');
  } else if (!config.walletPrivateKey && (!config.walletAddress || !config.apiSecret)) {
    console.error('[500x] LIVE mode requires either POLYARB_WALLET_PRIVATE_KEY or a valid walletAddress + apiSecret (L2 proxy signing)');
    process.exit(1);
  } else if (!config.walletPrivateKey) {
    console.log('[500x] LIVE mode — using POLY_PROXY signing (L2 api_secret)');
  }

  const supabase = getSupabase();
  await supabase
    .from('polyarb_agents')
    .update({ status: 'RUNNING', last_heartbeat_at: new Date().toISOString() })
    .eq('id', config.agentId);

  await logCompliance(config.agentId, config.userId, 'AGENT_START');

  const binanceFeed = new BinanceFeed();
  const polymarketFeed = new PolymarketFeed();
  const positionTracker = new PositionTracker(config.agentId, config.userId);
  const orderManager = new OrderManager(
    config.apiKey,
    config.apiSecret,
    config.apiPassphrase,
    config.walletPrivateKey,
    config.dryRun,
    config.walletAddress,
  );
  const telemetryWriter = new TelemetryWriter();
  const ctfRedeemer = new CtfRedeemer(config.walletPrivateKey, config.dryRun);

  await positionTracker.loadFromDb();
  await sweepUnsettledPositions(supabase, config.agentId);
  await redeemPendingWins(supabase, ctfRedeemer, config.agentId);

  // Approve USDC.e for the 3 Polymarket exchange contracts (idempotent).
  // Without this, /balance-allowance returns 0 even with USDC.e in the wallet
  // and the bot sees zero buying power. Skipped in DRY_RUN.
  try {
    await orderManager.ensureAllowances();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[500x] ensureAllowances failed — bot cannot trade until approved: ${msg.slice(0, 200)}`);
    await logCompliance(
      config.agentId,
      config.userId,
      'CONFIG_CHANGE',
      undefined,
      undefined,
      undefined,
      { error: 'USDC.e approval failed at startup', detail: msg.slice(0, 500) },
    );
    // Continue running so heartbeat/logs work and the user gets visibility.
  }

  // Persist wallet_address to DB if missing (one-time backfill).
  const walletAddress = orderManager.getWalletAddress();
  if (walletAddress) {
    const { error: walletUpdateErr } = await supabase
      .from('polyarb_agents')
      .update({ wallet_address: walletAddress })
      .eq('id', config.agentId)
      .is('wallet_address', null);
    if (walletUpdateErr) {
      console.warn(`[500x] wallet_address persist warning: ${walletUpdateErr.message}`);
    }
  }

  await orderManager.updateBalanceAllowance();
  const balances = await orderManager.fetchOnChainBalance();
  console.log(`[500x] CLOB balance:   ${balances.clob   !== null ? `$${balances.clob.toFixed(4)} USDC`   : 'N/A'}`);
  console.log(`[500x] Wallet balance: ${balances.wallet !== null ? `$${balances.wallet.toFixed(4)} USDC` : 'N/A'}`);
  console.log(`[500x] Total balance:  ${balances.total  !== null ? `$${balances.total.toFixed(4)} USDC`  : 'N/A'}`);

  binanceFeed.start();
  console.log('[500x] Binance WS feed started');

  // Phase B — Coinbase WS for multi-source spot consensus.
  const coinbaseFeed = config.params.useCoinbase ? new CoinbaseFeed() : null;
  if (coinbaseFeed) {
    coinbaseFeed.start();
    console.log('[500x] Coinbase WS feed started (Phase B consensus)');
  } else {
    console.log('[500x] Coinbase feed DISABLED (POLYARB_50X_USE_COINBASE=false)');
  }

  // Engine v2 multi-source feeds (perp + IV). Started only when v2 mode is
  // active so legacy deployments don't open extra sockets.
  const engineV2Mode = resolveEngineV2Mode();
  const perpFeed = new BinancePerpFeed();
  const ivFeed = new DeribitIVFeed();
  if (engineV2Mode !== 'off') {
    perpFeed.start();
    ivFeed.start();
    console.log(`[500x] Engine v2 feeds started (mode=${engineV2Mode}): binance-perp + deribit-iv`);
  } else {
    console.log('[500x] Engine v2 OFF — perp/IV feeds not started');
  }

  const markets = await polymarketFeed.fetchCryptoMarkets();
  const activeMarkets = markets.filter(m => m.active);
  console.log(`[500x] Found ${activeMarkets.length} active crypto markets`);

  const milestoneMap = new Map<string, number | null>();
  for (const market of activeMarkets) {
    milestoneMap.set(market.conditionId, parseMilestonePrice(market.question));
  }
  console.log(`[500x] Parsed milestones: ${[...milestoneMap.entries()].filter(([, v]) => v !== null).length}/${activeMarkets.length} markets`);

  if (activeMarkets.length > 0) {
    polymarketFeed.start(activeMarkets.map(m => m.conditionId));
    console.log('[500x] Polymarket feed started');
  } else {
    console.warn('[500x] No active crypto markets found — will retry in loop');
  }

  telemetryWriter.start();
  console.log('[500x] Telemetry writer started');

  const cbState = createCircuitBreakerState(config.startingCapitalUsd);
  const metrics = createLoopMetrics50x(config.startingCapitalUsd);

  const fundamentalEngine = new FundamentalEngine();
  fundamentalEngine.start();

  const windowGate = new WindowGate();
  const calibrationTracker = new CalibrationTracker(config.agentId, config.userId);

  const eventDetector = new EventDetector();
  const macroEventFeed = new MacroEventFeed();
  if (config.params.flagAggressive) {
    console.log('[500x] *** EVENT-DRIVEN MODE ACTIVE — Kelly cap up to 40% during events ***');
  }

  void calibrationTracker.loadFromDb().then(() => {
    console.log('[500x] Calibration Tracker loaded');
  }).catch((err: unknown) => {
    console.warn('[500x] Calibration Tracker load failed (non-critical):', err);
  });

  const cascadeState = new CascadeState();
  const scheduler = new TradeScheduler();
  const realtimeMetrics = new RealtimeMetrics();
  const anomalyDetector = new AnomalyDetector();

  const deploymentDate = process.env.POLYARB_50X_DEPLOYMENT_DATE
    ? new Date(process.env.POLYARB_50X_DEPLOYMENT_DATE)
    : new Date();
  if (process.env.POLYARB_50X_DEPLOYMENT_DATE) {
    console.log(`[500x] deployment_date=${deploymentDate.toISOString()} (from env)`);
  } else {
    console.log(`[500x] deployment_date=${deploymentDate.toISOString()} (defaulted to process start)`);
  }

  const kellyAdjuster500x = new KellyAdjuster500xOptionB(config.agentId, deploymentDate);
  const day10Validator = new Day10Validator(kellyAdjuster500x, realtimeMetrics);

  // Phase B — stateful skill instances. Each gated by its own flag.
  const adaptiveKelly = config.params.useAdaptiveKelly
    ? new AdaptiveKelly(config.params.minEdgePercent)
    : undefined;
  const bayesianWR = config.params.useBayesianWR ? new BayesianWinRate() : undefined;
  const memoryBank = config.params.useMemoryBank
    ? new MemoryBank(config.agentId, config.userId)
    : undefined;
  const sessionClock = config.params.useSessionClock ? new SessionClock() : undefined;
  if (memoryBank) {
    void memoryBank.loadFromDb().catch((err) =>
      console.warn(`[500x] WARN memory-bank loadFromDb: ${(err as Error).message}`),
    );
  }
  if (adaptiveKelly) console.log('[500x] AdaptiveKelly initialized (multiplier=1.0)');
  if (bayesianWR)    console.log('[500x] BayesianWinRate initialized (Beta(2,2) prior)');
  if (memoryBank)    console.log('[500x] MemoryBank initialized');
  if (sessionClock)  console.log('[500x] SessionClock initialized');

  await realtimeMetrics.hydrateFromSupabase(supabase, config.agentId, 11).catch((err) => {
    console.warn(`[500x] WARN realtime-metrics hydrate failed; starting cold: ${(err as Error).message}`);
  });

  const deps: LoopDeps50x = {
    config,
    binanceFeed,
    polymarketFeed,
    positionTracker,
    orderManager,
    telemetryWriter,
    cbState,
    milestoneMap,
    fundamentalEngine,
    windowGate,
    calibrationTracker,
    statCB: createStatCBState(),
    eventDetector,
    macroEventFeed,
    cascadeState,
    scheduler,
    realtimeMetrics,
    anomalyDetector,
    day10Validator,
    kellyAdjuster500x,
    perpFeed,
    ivFeed,
    coinbaseFeed: coinbaseFeed ?? undefined,
    adaptiveKelly,
    bayesianWR,
    memoryBank,
    sessionClock,
  };

  const refreshMarkets = async () => {
    try {
      const fresh = await polymarketFeed.fetchCryptoMarkets();
      const freshActive = fresh.filter(m => m.active);
      if (freshActive.length === 0) return;
      const currentIds = new Set(deps.milestoneMap.keys());
      for (const m of freshActive) {
        if (!currentIds.has(m.conditionId)) {
          deps.milestoneMap.set(m.conditionId, parseMilestonePrice(m.question));
          console.log(`[50x markets] New market discovered: ${m.question.slice(0, 60)}`);
        }
      }
      polymarketFeed.start(freshActive.map(m => m.conditionId));
    } catch (err) {
      console.error('[50x markets] Refresh error:', err);
    }
  };
  marketRefreshInterval = setInterval(() => void refreshMarkets(), 5 * 60_000);

  const pollRealBalance = async () => {
    await orderManager.updateBalanceAllowance();
    const { clob, wallet, total } = await orderManager.fetchOnChainBalance();
    if (total !== null) {
      metrics.realClobBalance = total;
      console.log(`[50x balance] CLOB=$${(clob ?? 0).toFixed(4)} Wallet=$${(wallet ?? 0).toFixed(4)} Total=$${total.toFixed(4)} USDC`);
    }
  };
  void pollRealBalance();
  balancePollInterval = setInterval(() => void pollRealBalance(), 30_000);

  running = true;
  console.log(`[500x] Trading loop starting (${config.params.loopIntervalMs}ms interval)`);

  const runLoop = async (): Promise<void> => {
    if (!running) return;
    const tickStart = Date.now();
    try {
      await tradingTick50x(deps, metrics);
    } catch (err) {
      console.error('[500x] Loop error:', err);
      metrics.errorCount1h++;
    }
    if (!running) return;
    const elapsed = Date.now() - tickStart;
    const delay = Math.max(0, config.params.loopIntervalMs - elapsed);
    loopTimeout = setTimeout(() => void runLoop(), delay);
  };
  void runLoop();

  commandPollInterval = setInterval(async () => {
    await pollCommands(config, deps, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine);
  }, 5_000);

  const stopV2Feeds = () => {
    perpFeed.stop();
    ivFeed.stop();
    coinbaseFeed?.stop();
  };
  process.on('SIGINT', () => { stopV2Feeds(); shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine); });
  process.on('SIGTERM', () => { stopV2Feeds(); shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine); });

  console.log('[500x] PolyArb 500x engine running. Press Ctrl+C to stop.');
}

async function pollCommands(
  config: FiftyXAgentConfig,
  deps: LoopDeps50x,
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
  const prev = lastSeenStatus;
  lastSeenStatus = status;

  // Only act on user-driven status TRANSITIONS in the DB. Without this,
  // the circuit breaker (which toggles tradingEnabled off on WS disconnect,
  // drawdown, etc.) would cause the RESUME branch to fire every 5s — the
  // CB had set tradingEnabled=false, status was still RUNNING, so each
  // poll re-armed trading and re-logged "Received RESUME command".
  if (status === prev) return;

  if (status === 'STOPPED' && running) {
    console.log('[500x] Received STOP command');
    running = false;
    deps.cbState.tradingEnabled = false;
    shutdown(config, binanceFeed, polymarketFeed, telemetryWriter, fundamentalEngine);
  } else if (status === 'PAUSED') {
    console.log('[500x] Received PAUSE command');
    deps.cbState.tradingEnabled = false;
    void logCompliance(config.agentId, config.userId, 'AGENT_PAUSE');
  } else if (status === 'RUNNING' && running) {
    console.log('[500x] Received RESUME command');
    deps.cbState.tradingEnabled = true;
    deps.cbState.pausedUntil = null;
    void logCompliance(config.agentId, config.userId, 'AGENT_RESUME');
  }
}

function shutdown(
  config: FiftyXAgentConfig,
  binanceFeed: BinanceFeed,
  polymarketFeed: PolymarketFeed,
  telemetryWriter: TelemetryWriter,
  fundamentalEngine: FundamentalEngine,
): void {
  console.log('[500x] Shutting down...');
  running = false;

  if (loopTimeout) { clearTimeout(loopTimeout); loopTimeout = null; }
  if (commandPollInterval) { clearInterval(commandPollInterval); commandPollInterval = null; }
  if (marketRefreshInterval) { clearInterval(marketRefreshInterval); marketRefreshInterval = null; }
  if (balancePollInterval) { clearInterval(balancePollInterval); balancePollInterval = null; }

  binanceFeed.stop();
  polymarketFeed.stop();
  telemetryWriter.stop();
  fundamentalEngine.stop();

  const supabase = getSupabase();
  void supabase
    .from('polyarb_agents')
    .update({ status: 'STOPPED' })
    .eq('id', config.agentId);

  void logCompliance(config.agentId, config.userId, 'AGENT_STOP');

  console.log('[500x] Shutdown complete');
  setTimeout(() => process.exit(0), 2_000);
}

main().catch((err) => {
  console.error('[500x] Fatal error:', err);
  process.exit(1);
});
