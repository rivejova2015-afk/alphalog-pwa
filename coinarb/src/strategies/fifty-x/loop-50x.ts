/**
 * Coinarb 50x — lean cross-venue tick loop.
 *
 * Pipeline (every params.loopIntervalMs):
 *   1. Pull spot prices (Coinbase WS + Binance WS, take median)
 *   2. Pull perp quote + funding (Coinbase International WS)
 *   3. Compute momentum vector (jerk-aware) per symbol
 *   4. Build directional gap = mean(jerk-implied move, vol-gap implied move)
 *   5. Run guardrails: cooldown, daily cap, drawdown breaker, funding gate, max-open
 *   6. Decide tier: ENTER / SCALP / SKIP based on |gap|, confidence, validated layers
 *   7. Size with Kelly × scalpKellyMultiplier (if SCALP)
 *   8. Round to product cache (min_size + price_increment)
 *   9. Choose venue: prefer perp (leverage) unless funding adverse → fall back to spot
 *  10. Place limit @ best opposite (post_only) via spot or perp broker
 *  11. Track in CoinarbPositionTracker
 *  12. Manage open positions: take-profit on +trigger %, stop on −stopPct, breaker close-all
 *  13. Notify push, log decision (throttled SKIPs)
 *  14. Watchdog: restart loop if no WS tick for params.wsStaleTimeoutMs
 */

import type { CoinbaseFeed } from '../../feeds/coinbase-ws.js';
import type { BinanceFeed } from '../../feeds/binance-ws.js';
import type { CoinbaseIntxFeed } from '../../feeds/coinbase-intx-ws.js';
import type { SpotBroker, PerpBroker } from '../../paper/paper-broker.js';
import { CoinarbPositionTracker, type Venue, type Side } from '../../trading/coinarb-positions.js';
import { FundingGate } from '../../trading/funding-gate.js';
import { calculateMomentumVector } from '../../math/momentum-physics.js';
import { DecisionLogger } from '../../ops/decision-logger.js';
import { notify, formatEntry, formatExit, formatBreaker, formatDaily } from '../../ops/notify-alphalog.js';
import { getSupabase } from '../../supabase.js';
import { detectRegime, type RegimeState } from '../../skills/regime-detector.js';
import { computeReversalSignal } from '../../skills/reversal-radar.js';
import { AdaptiveKelly } from '../../skills/adaptive-kelly.js';
import type { PriceSample } from '../../skills/velocity-detector.js';
import { validate as validateFiveLayer } from './five-layer-validator.js';
import { estimateFeeUsd } from './fees.js';
import type { FiftyXAgentConfig, FiftyXParams } from './config-50x.js';

interface ProductCache {
  spot: Record<string, { baseMinSize: number; baseIncrement: number; priceIncrement: number; status: string }>;
  perp: Record<string, { minOrderSize: number; baseIncrement: number; quoteIncrement: number; status: string }>;
}

const SPOT_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD'] as const;
const PERP_SYMBOLS = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'] as const;
const PRICE_HISTORY_LEN = 80;

type FeedSymbol = 'BTC' | 'ETH' | 'SOL';

function productToFeedSymbol(product: string): FeedSymbol | null {
  if (product.startsWith('BTC')) return 'BTC';
  if (product.startsWith('ETH')) return 'ETH';
  if (product.startsWith('SOL')) return 'SOL';
  return null;
}
const GAP_WINDOW_SAMPLES = 60;     // 60 × 200ms = 12s window for crypto micro-moves
const TAKE_PROFIT_PCT = 0.015;     // close winners at +1.5% notional move
const STOP_LOSS_PCT = 0.020;       // hard stop at -2% notional move

interface PerSymbolState {
  history: number[];               // recent prices for momentum derivative
  samples: PriceSample[];          // price + ts pairs for regime-detector (BTC only used today)
  lastSampleAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface LoopState {
  startedAt: number;
  peakEquityUsd: number;
  currentEquityUsd: number;
  wins: number;
  losses: number;
  consecutiveWins: number;
  tradesToday: number;
  todayUtcDay: number;             // YYYYMMDD as integer
  cooldownUntil: number;
  drawdownPauseUntil: number;
  lastTickAt: number;
  lastDailyNoticeDay: number;
}

function utcDay(ts = Date.now()): number {
  const d = new Date(ts);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function median(values: number[]): number {
  const sorted = [...values].filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function roundToIncrement(value: number, increment: number): number {
  if (!Number.isFinite(increment) || increment <= 0) return value;
  return Math.floor(value / increment) * increment;
}

export interface LoopDeps {
  config: FiftyXAgentConfig;
  coinbaseFeed: CoinbaseFeed;
  binanceFeed: BinanceFeed;
  intxFeed: CoinbaseIntxFeed;
  spotBroker: SpotBroker;
  perpBroker: PerpBroker;
  productCache: ProductCache;
}

export class CoinarbLoop {
  private readonly tracker: CoinarbPositionTracker;
  private readonly fundingGate: FundingGate;
  private readonly logger = new DecisionLogger();
  private readonly perSymbol = new Map<string, PerSymbolState>();
  private readonly adaptiveKelly: AdaptiveKelly;
  private readonly state: LoopState;
  private timer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastTickLatencyMs = 0;
  private lastRegime: RegimeState | null = null;
  private lastRegimeSnapshotAt = 0;

  constructor(private readonly deps: LoopDeps) {
    const c = deps.config;
    this.tracker = new CoinarbPositionTracker(c.agentId, c.userId);
    this.fundingGate = new FundingGate(deps.intxFeed, c.params.fundingAdverseThreshold);
    this.adaptiveKelly = new AdaptiveKelly(c.params.maxKellyFraction);
    this.state = {
      startedAt: Date.now(),
      peakEquityUsd: c.startingCapitalUsd,
      currentEquityUsd: c.startingCapitalUsd,
      wins: 0,
      losses: 0,
      consecutiveWins: 0,
      tradesToday: 0,
      todayUtcDay: utcDay(),
      cooldownUntil: 0,
      drawdownPauseUntil: 0,
      lastTickAt: Date.now(),
      lastDailyNoticeDay: utcDay() - 1,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.tracker.loadFromDb();

    const interval = this.deps.config.params.loopIntervalMs;
    this.timer = setInterval(() => { void this.tick(); }, interval);
    this.heartbeatTimer = setInterval(() => { void this.writeHeartbeat(); }, 5_000);
    void this.writeHeartbeat(); // first beat immediately
    console.log(`[loop-50x] started — ${this.deps.config.paperMode ? 'PAPER' : 'LIVE'} mode, ${interval}ms tick`);

    notify({
      userId: this.deps.config.userId,
      ...formatBreaker({ kind: 'cooldown', message: `Coinarb ${this.deps.config.paperMode ? 'PAPER' : 'LIVE'} armed`, paper: this.deps.config.paperMode }),
      tag: 'coinarb-armed',
    });
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    console.log('[loop-50x] stopped');
  }

  private async writeHeartbeat(): Promise<void> {
    const c = this.deps.config;
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const totalTrades = this.state.wins + this.state.losses;
    const btcPrice = (() => {
      const cb = this.deps.coinbaseFeed.getPrice('BTC');
      const bn = this.deps.binanceFeed.getPrice('BTC');
      const m = median([cb?.last ?? 0, bn?.last ?? 0]);
      return m > 0 ? m : null;
    })();

    const payload = {
      user_id: c.userId,
      agent_id: c.agentId,
      equity_usd: this.state.currentEquityUsd,
      available_balance_usd: this.state.currentEquityUsd,
      open_positions_count: this.tracker.count,
      total_pnl_usd: this.state.currentEquityUsd - c.startingCapitalUsd,
      win_rate: totalTrades > 0 ? this.state.wins / totalTrades : null,
      max_drawdown_pct: this.drawdownPct(),
      loop_latency_ms: Math.round(this.lastTickLatencyMs),
      ws_binance_connected: this.deps.binanceFeed.isConnected ?? true,
      ws_polymarket_connected: this.deps.coinbaseFeed.isConnected ?? true,
      btc_spot_price: btcPrice,
      consecutive_wins: this.state.consecutiveWins,
      consecutive_losses: 0,
      error_count_1h: 0,
      last_heartbeat_at: nowIso,
      updated_at: nowIso,
      payload: { kind: 'coinarb', venue_mode: 'spot-only', paper: c.paperMode },
    };

    const { error: telErr } = await supabase
      .from('coinarb_telemetry')
      .upsert(payload, { onConflict: 'agent_id' });
    if (telErr) console.error('[heartbeat] telemetry upsert:', telErr.message);

    const { error: agErr } = await supabase
      .from('coinarb_agents')
      .update({ last_heartbeat_at: nowIso, status: 'RUNNING' })
      .eq('id', c.agentId);
    if (agErr) console.error('[heartbeat] agent update:', agErr.message);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const tickStart = Date.now();
    try {
      await this.tickBody(tickStart);
    } finally {
      this.lastTickLatencyMs = Date.now() - tickStart;
    }
  }

  private async tickBody(now: number): Promise<void> {
    this.rolloverDay(now);
    this.updateEquityPeak();

    // Watchdog — restart if no WS ticks recently. We don't auto-restart the
    // process (Fly does that on /health failure); we just log and skip.
    const stale = now - Math.max(this.deps.coinbaseFeed.isConnected ? now : 0, this.deps.intxFeed.lastTickTimestamp);
    if (stale > this.deps.config.params.wsStaleTimeoutMs && this.deps.intxFeed.lastTickTimestamp > 0) {
      console.warn(`[loop-50x] stale WS — ${stale}ms since last tick, skipping`);
      return;
    }
    this.state.lastTickAt = now;

    // Update price history for each spot symbol (used for momentum derivatives)
    for (const product of SPOT_SYMBOLS) {
      const sym = productToFeedSymbol(product);
      if (!sym) continue;
      const cb = this.deps.coinbaseFeed.getPrice(sym);
      const bn = this.deps.binanceFeed.getPrice(sym);
      const consensus = median([cb?.last ?? 0, bn?.last ?? 0]);
      if (consensus <= 0) continue;
      this.recordSample(product, consensus, now);
    }
    for (const symbol of PERP_SYMBOLS) {
      const q = this.deps.intxFeed.getQuote(symbol);
      if (!q || q.last <= 0) continue;
      this.recordSample(symbol, q.last, now);
    }

    // Refresh regime classification once per tick from the BTC spot stream
    // (acts as the broad market gauge for all symbols, matches regime-detector design).
    const btcState = this.perSymbol.get('BTC-USD');
    if (btcState && btcState.samples.length >= 10) {
      const next = detectRegime(btcState.samples);
      const prev = this.lastRegime?.regime ?? null;
      const isTransition = prev !== null && prev !== next.regime;
      const isPeriodic = Date.now() - this.lastRegimeSnapshotAt >= 5 * 60 * 1000;
      if (isTransition || isPeriodic || this.lastRegimeSnapshotAt === 0) {
        void this.persistRegimeSnapshot(next, prev, isTransition);
        this.lastRegimeSnapshotAt = Date.now();
      }
      this.lastRegime = next;
    }

    // Manage open positions (take-profit / stop-loss / drawdown breaker)
    await this.manageOpen(now);

    // If drawdown breaker active, no new entries
    if (now < this.state.drawdownPauseUntil) return;
    if (now < this.state.cooldownUntil) return;
    if (this.state.tradesToday >= this.deps.config.params.dailyTradeCap) return;
    if (this.tracker.count >= this.deps.config.params.maxOpenPositions) return;

    // Daily summary push (once per UTC day)
    if (this.state.todayUtcDay !== this.state.lastDailyNoticeDay) {
      this.state.lastDailyNoticeDay = this.state.todayUtcDay;
      notify({
        userId: this.deps.config.userId,
        ...formatDaily({
          trades: this.state.tradesToday,
          pnlUsd: this.state.currentEquityUsd - this.deps.config.startingCapitalUsd,
          winRate: this.state.wins + this.state.losses > 0 ? this.state.wins / (this.state.wins + this.state.losses) : 0,
          drawdownPct: this.drawdownPct(),
          paper: this.deps.config.paperMode,
        }),
        tag: `coinarb-daily-${this.state.todayUtcDay}`,
      });
    }

    // Generate one signal per symbol, attempt one entry per tick
    const params = this.deps.config.params;
    for (const symbol of [...SPOT_SYMBOLS, ...PERP_SYMBOLS]) {
      const venue: Venue = symbol.endsWith('-PERP') ? 'perp' : 'spot';
      if (venue === 'spot' && !params.spotEnabled) continue;
      if (venue === 'perp' && !params.perpEnabled) continue;
      if (this.tracker.forSymbol(venue, symbol).length > 0) continue;     // already in
      const entered = await this.maybeEnter(symbol, venue, now);
      if (entered) break;                                                  // one entry per tick
    }
  }

  private recordSample(key: string, price: number, now: number): void {
    let s = this.perSymbol.get(key);
    if (!s) { s = { history: [], samples: [], lastSampleAt: 0 }; this.perSymbol.set(key, s); }
    if (now - s.lastSampleAt < this.deps.config.params.loopIntervalMs * 0.8) return;
    s.history.push(price);
    if (s.history.length > PRICE_HISTORY_LEN) s.history.shift();
    s.samples.push({ price, timestamp: now });
    // Keep ~1 hour of samples for regime classification (regime-detector windows: 1h/15m/5m).
    const cutoff = now - 3_600_000;
    while (s.samples.length > 0 && s.samples[0].timestamp < cutoff) s.samples.shift();
    s.lastSampleAt = now;
  }

  private async maybeEnter(symbol: string, venue: Venue, now: number): Promise<boolean> {
    const c = this.deps.config;
    const params = c.params;
    const sample = this.perSymbol.get(symbol);
    if (!sample || sample.history.length < 8) return false;

    const dt = params.loopIntervalMs / 1000;
    const mv = calculateMomentumVector(sample.history, dt);

    if (mv.signal === 'HOLD') {
      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
        reason: `momentum HOLD jerk=${mv.jerk.toFixed(6)}`,
      });
      return false;
    }

    const side: Side = mv.signal === 'BUY' ? 'BUY' : 'SELL';

    // Reversal radar — block entries that fight a jerk-confirmed flip.
    // REVERSE_LONG = "was going up, now braking hard" → don't BUY.
    // REVERSE_SHORT = "was going down, bouncing"      → don't SELL.
    const reversal = computeReversalSignal(sample.history, dt);
    if (reversal.reversalImminent) {
      const blocks =
        (reversal.signal === 'REVERSE_LONG' && side === 'BUY') ||
        (reversal.signal === 'REVERSE_SHORT' && side === 'SELL');
      if (blocks) {
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `reversal_against ${reversal.signal} conf=${reversal.confidence.toFixed(2)}`,
        });
        return false;
      }
    }

    // Funding gate — only relevant for perps
    if (venue === 'perp') {
      const fg = this.fundingGate.check(symbol, side);
      if (!fg.allowed) {
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `funding gate: ${fg.reason}`,
        });
        return false;
      }
    }

    // Recent return % over last 60 samples (12s) — crypto micro-move window
    const recent = sample.history.slice(-GAP_WINDOW_SAMPLES);
    const ret = (recent[recent.length - 1] - recent[0]) / recent[0];
    const absGap = Math.abs(ret);
    const confidence = Math.min(1, mv.confidence * (0.5 + Math.min(0.5, absGap * 50)));

    // Regime-adjusted ENTER threshold: in VOLATILE/CRISIS we tighten by 1/agentMultiplier
    // (e.g. 1/0.5 = 2× stricter), in TRENDING we relax. CALM is unchanged.
    const regime = this.lastRegime;
    const regimeMult = regime?.agentMultiplier ?? 1;
    const enterMinGapEff = regimeMult > 0 ? params.enterMinGap / regimeMult : params.enterMinGap;
    const scalpMinGapEff = regimeMult > 0 ? params.scalpMinGap / regimeMult : params.scalpMinGap;

    // Decision tier (post-regime adjustment)
    let tier: 'ENTER' | 'SCALP' | 'SKIP';
    if (absGap >= enterMinGapEff && confidence >= params.enterMinConfidence) tier = 'ENTER';
    else if (absGap >= scalpMinGapEff && confidence >= params.scalpMinConfidence) tier = 'SCALP';
    else tier = 'SKIP';

    if (tier === 'SKIP') {
      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
        reason: `tier=SKIP gap=${(absGap * 100).toFixed(2)}% conf=${confidence.toFixed(2)} regime=${regime?.regime ?? 'NA'}`,
      });
      return false;
    }

    // Five-layer validator — orthogonal scoring of realness/duration/reversal/capital_fit/exit_clarity.
    // SKIPs anything below the configured overall confidence floor.
    const validation = validateFiveLayer({
      gap: ret,
      regime,
      reversal,
      msLeftInWindow: params.entryWindowMs,
      minEdgePercent: params.enterMinGap,
    });
    if (validation.overallConfidence < params.validatorMinConfidence) {
      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
        reason: `low_confidence ${validation.overallConfidence.toFixed(2)} < ${params.validatorMinConfidence.toFixed(2)}`,
        meta: { validatedCount: validation.validatedCount, layers: validation.layers.map(l => ({ n: l.name, s: l.score })) },
      });
      return false;
    }

    // Adaptive-Kelly minimum edge gate — tightens after losing streaks, relaxes after wins.
    // Pure threshold check: regime applies to sizing below, not to this floor.
    const adaptiveMinEdge = this.adaptiveKelly.getCurrentMinEdge(1.0);
    if (absGap < adaptiveMinEdge) {
      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
        reason: `adaptive_min_edge gap=${(absGap * 100).toFixed(2)}% < ${(adaptiveMinEdge * 100).toFixed(2)}%`,
      });
      return false;
    }

    // Live price for sizing
    let bid = 0, ask = 0, last = 0;
    if (venue === 'spot') {
      const sym = productToFeedSymbol(symbol);
      if (!sym) return false;
      const cb = this.deps.coinbaseFeed.getPrice(sym);
      if (!cb) return false;
      bid = cb.bid; ask = cb.ask; last = cb.last;
    } else {
      const q = this.deps.intxFeed.getQuote(symbol);
      if (!q) return false;
      bid = q.bid; ask = q.ask; last = q.last;
    }
    if (bid <= 0 || ask <= 0) return false;

    // Size: Kelly fraction × allocation × capital × tier multiplier × regime multiplier
    const allocation = venue === 'spot' ? params.spotAllocationPct : params.perpAllocationPct;
    const tierMult = tier === 'SCALP' ? params.scalpKellyMultiplier : 1;
    const targetUsd = c.startingCapitalUsd * allocation * params.maxKellyFraction * tierMult * regimeMult;
    const leverage = venue === 'perp' ? params.maxLeverage : 1;
    const notionalUsd = targetUsd * leverage;

    // Round base size to increment + min size
    const incr = venue === 'spot'
      ? this.deps.productCache.spot[symbol]?.baseIncrement ?? 0.00000001
      : this.deps.productCache.perp[symbol]?.baseIncrement ?? 0.0001;
    const minSize = venue === 'spot'
      ? this.deps.productCache.spot[symbol]?.baseMinSize ?? 0.0001
      : this.deps.productCache.perp[symbol]?.minOrderSize ?? 0.0001;
    const rawBase = notionalUsd / last;
    const baseSize = roundToIncrement(rawBase, incr);

    if (baseSize < minSize) {
      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
        reason: `size ${baseSize} < minSize ${minSize}`,
      });
      return false;
    }

    // Correlation cap by base asset — BTC-USD spot + BTC-PERP = same narrative,
    // not 2 independent bets. Cap aggregate exposure per base asset to params.maxAggregateExposurePct.
    const baseAsset = productToFeedSymbol(symbol);
    if (baseAsset) {
      const sameAssetUsd = this.tracker
        .list()
        .filter(p => productToFeedSymbol(p.symbol) === baseAsset)
        .reduce((s, p) => s + p.sizeUsd, 0);
      const projectedNotional = baseSize * last;
      const cap = c.startingCapitalUsd * params.maxAggregateExposurePct;
      if (sameAssetUsd + projectedNotional > cap) {
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `correlation_cap ${baseAsset} ${(sameAssetUsd + projectedNotional).toFixed(0)} > ${cap.toFixed(0)}`,
          meta: { baseAsset, sameAssetUsd, projectedNotional, cap },
        });
        return false;
      }
    }

    // Limit price = best opposite (post-only crosses on the resting side)
    const priceIncr = venue === 'spot'
      ? this.deps.productCache.spot[symbol]?.priceIncrement ?? 0.01
      : this.deps.productCache.perp[symbol]?.quoteIncrement ?? 0.01;
    const limitRaw = side === 'BUY' ? bid : ask;
    const limitPrice = roundToIncrement(limitRaw, priceIncr);

    // Intended price = where we *wanted* to fill. Slippage is measured vs this.
    const intendedPrice = side === 'BUY' ? ask : bid;

    // Place
    const placedAt = Date.now();
    let orderId: string | undefined;
    let filledPrice = limitPrice;
    if (venue === 'spot') {
      const ack = await this.deps.spotBroker.placeLimit({
        productId: symbol,
        side,
        baseSize: baseSize.toFixed(8),
        limitPrice: limitPrice.toFixed(2),
        postOnly: params.postOnly,
      });
      if (!ack.success) {
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `spot placeLimit failed: ${ack.failureReason ?? 'unknown'}`,
        });
        return false;
      }
      orderId = ack.orderId;
      const raw = ack.raw as { filledPrice?: number };
      if (raw?.filledPrice) filledPrice = raw.filledPrice;
    } else {
      const ack = await this.deps.perpBroker.placeLimit({
        symbol,
        side,
        size: baseSize.toFixed(4),
        price: limitPrice.toFixed(2),
        postOnly: params.postOnly,
      });
      if (!ack.success) {
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `perp placeLimit rejected`,
        });
        return false;
      }
      orderId = ack.orderId;
      const raw = ack.raw as { filledPrice?: number };
      if (raw?.filledPrice) filledPrice = raw.filledPrice;
    }

    // Cancel/replace timeout — for real brokers a post-only order may rest unfilled.
    // Poll getOrder until status reports FILLED or timeout, then cancel and skip.
    // Paper brokers fill synchronously and report 'FILLED' immediately, so the loop is a single hop.
    let filled = false;
    const broker = venue === 'spot' ? this.deps.spotBroker : this.deps.perpBroker;
    if (orderId) {
      while (Date.now() - placedAt < params.fillTimeoutMs) {
        try {
          const status = await broker.getOrder(orderId) as { status?: string; filled_size?: number; filledPrice?: number };
          const s = String(status?.status ?? '').toUpperCase();
          if (s === 'FILLED' || s === 'DONE' || s === 'CLOSED' || (status?.filled_size ?? 0) > 0) {
            filled = true;
            if (status?.filledPrice) filledPrice = status.filledPrice;
            break;
          }
        } catch {
          // transient — keep polling until timeout
        }
        await sleep(100);
      }
      if (!filled) {
        try { await broker.cancel([orderId]); } catch { /* best-effort */ }
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'SKIP', symbol, venue,
          reason: `fill_timeout ${params.fillTimeoutMs}ms`,
          meta: { orderId, limitPrice },
        });
        return false;
      }
    } else {
      // No orderId returned but ack.success was true — treat as filled at limit.
      filled = true;
    }

    const fillLatencyMs = Date.now() - placedAt;
    const sizeUsd = baseSize * filledPrice;

    // Slippage: + means worse than intended (paid more on BUY, received less on SELL).
    const slippageUsd = side === 'BUY'
      ? (filledPrice - intendedPrice) * baseSize
      : (intendedPrice - filledPrice) * baseSize;
    const slippageBps = intendedPrice > 0
      ? Math.round(((filledPrice - intendedPrice) / intendedPrice) * 10_000) * (side === 'BUY' ? 1 : -1)
      : 0;

    // Estimated entry-side fee. Round-trip fee is captured separately at exit.
    const feeUsd = estimateFeeUsd(venue, sizeUsd, params.postOnly);

    // Track
    await this.tracker.openPosition({
      venue, symbol, side,
      entryPrice: filledPrice,
      sizeUsd,
      baseSize,
      leverageUsed: leverage,
      brokerOrderId: orderId ?? '',
      entryReason: {
        tier,
        gap: ret,
        jerk: mv.jerk,
        confidence,
        paper: c.paperMode,
        regime: regime?.regime ?? null,
        regimeMult,
        validatorConfidence: validation.overallConfidence,
        validatedCount: validation.validatedCount,
        adaptiveMinEdge,
        intendedPrice,
        filledPrice,
        slippageUsd,
        slippageBps,
        feeUsdEstimated: feeUsd,
        fillLatencyMs,
      },
    });

    this.state.tradesToday += 1;
    await this.logger.log({
      agentId: c.agentId, userId: c.userId, kind: tier, symbol, venue,
      reason: `entered ${side} size=${baseSize} @${filledPrice} (slip=${slippageBps}bps lat=${fillLatencyMs}ms regime=${regime?.regime ?? 'NA'})`,
      meta: { tier, jerk: mv.jerk, confidence, sizeUsd, regime: regime?.regime, validatorConfidence: validation.overallConfidence, slippageBps, fillLatencyMs, feeUsd },
    });

    notify({
      userId: c.userId,
      ...formatEntry({
        venue, symbol, side, filledPrice, sizeUsd,
        reason: `${tier} jerk=${mv.jerk.toExponential(2)} ${regime?.regime ?? ''}`,
        paper: c.paperMode,
      }),
      tag: `coinarb-entry-${orderId ?? Date.now()}`,
    });
    return true;
  }

  private async manageOpen(now: number): Promise<void> {
    const c = this.deps.config;
    const params = c.params;
    for (const pos of this.tracker.list()) {
      const px = this.currentPrice(pos.venue, pos.symbol);
      if (!px) continue;

      const move = pos.side === 'BUY'
        ? (px - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - px) / pos.entryPrice;

      let exitReason: string | null = null;
      if (move >= TAKE_PROFIT_PCT) exitReason = `take_profit ${(move * 100).toFixed(2)}%`;
      else if (move <= -STOP_LOSS_PCT) exitReason = `stop_loss ${(move * 100).toFixed(2)}%`;
      // hold timeout — close after 15 min no matter what (scalp horizon)
      else if (now - pos.openedAt > 15 * 60_000) exitReason = `time_stop ${Math.round((now - pos.openedAt) / 60_000)}min`;

      if (!exitReason) continue;

      // Round-trip cost = entry fee (already paid + recorded in entry_reason)
      // + exit fee. We pass exit-side fee here so coinarb_trades.fee_usd reflects exit cost.
      const exitNotional = pos.baseSize * px;
      const exitFeeUsd = estimateFeeUsd(pos.venue, exitNotional, params.postOnly);

      const closed = await this.tracker.closePosition(pos.id, px, exitReason, {
        feeUsd: exitFeeUsd,
        slippageBps: 0,         // exits are market-priced off the live last; no intended price to compare
        executionLatencyMs: 0,   // synchronous bookkeeping, no order placed for the close
      });
      if (!closed) continue;

      const win = closed.pnlUsd > 0;
      this.state.currentEquityUsd += closed.pnlUsd;
      if (win) { this.state.wins += 1; this.state.consecutiveWins += 1; }
      else { this.state.losses += 1; this.state.consecutiveWins = 0; this.state.cooldownUntil = now + c.params.lossCooldownMs; }

      // Feed the outcome back into adaptive-Kelly so future entries tighten/loosen automatically.
      const entryGap = typeof pos.entryReason.gap === 'number' ? Math.abs(pos.entryReason.gap as number) : 0;
      this.adaptiveKelly.recordOutcome({
        conditionId: pos.id,
        edge: entryGap,
        pnlUsd: closed.pnlUsd,
        won: win,
        symbol: pos.symbol,
        computedAt: Date.now(),
      });

      // Calibration: store predicted_confidence vs actual outcome for the
      // dashboard reliability diagram + Brier score breakdown by regime/tier.
      void this.persistCalibration(pos, closed, win, entryGap);

      await this.logger.log({
        agentId: c.agentId, userId: c.userId, kind: 'EXIT', symbol: pos.symbol, venue: pos.venue,
        reason: exitReason, meta: { pnlUsd: closed.pnlUsd, pnlPercent: closed.pnlPercent, exitFeeUsd },
      });

      notify({
        userId: c.userId,
        ...formatExit({
          venue: pos.venue, symbol: pos.symbol,
          pnlUsd: closed.pnlUsd, pnlPercent: closed.pnlPercent,
          exitPrice: px, reason: exitReason, paper: c.paperMode,
        }),
        tag: `coinarb-exit-${pos.id}`,
      });

      // Drawdown breaker — triggers on aggregate equity DD
      if (this.drawdownPct() >= c.params.drawdownBreakerPct) {
        const prices = this.snapshotPrices();
        await this.tracker.closeAll(
          prices,
          'circuit_breaker',
          (p, exitPx) => estimateFeeUsd(p.venue, p.baseSize * exitPx, params.postOnly),
        );
        this.state.drawdownPauseUntil = now + c.params.drawdownBreakerCooldownMs;
        await this.logger.log({
          agentId: c.agentId, userId: c.userId, kind: 'BREAKER',
          reason: `drawdown breaker — DD=${(this.drawdownPct() * 100).toFixed(2)}% pause ${Math.round(c.params.drawdownBreakerCooldownMs / 3_600_000)}h`,
        });
        notify({
          userId: c.userId,
          ...formatBreaker({
            kind: 'drawdown',
            message: `DD ${(this.drawdownPct() * 100).toFixed(1)}% — pausa ${Math.round(c.params.drawdownBreakerCooldownMs / 3_600_000)}h`,
            paper: c.paperMode,
          }),
          tag: `coinarb-breaker-${now}`,
        });
        return;
      }
    }
  }

  private currentPrice(venue: Venue, symbol: string): number | null {
    if (venue === 'spot') {
      const sym = productToFeedSymbol(symbol);
      if (!sym) return null;
      return this.deps.coinbaseFeed.getPrice(sym)?.last ?? null;
    }
    return this.deps.intxFeed.getQuote(symbol)?.last ?? null;
  }

  private snapshotPrices(): Map<string, number> {
    const m = new Map<string, number>();
    for (const product of SPOT_SYMBOLS) {
      const sym = productToFeedSymbol(product);
      if (!sym) continue;
      const px = this.deps.coinbaseFeed.getPrice(sym)?.last;
      if (px) m.set(`spot:${product}`, px);
    }
    for (const symbol of PERP_SYMBOLS) {
      const px = this.deps.intxFeed.getQuote(symbol)?.last;
      if (px) m.set(`perp:${symbol}`, px);
    }
    return m;
  }

  private rolloverDay(now: number): void {
    const today = utcDay(now);
    if (today !== this.state.todayUtcDay) {
      this.state.todayUtcDay = today;
      this.state.tradesToday = 0;
    }
  }

  private updateEquityPeak(): void {
    if (this.state.currentEquityUsd > this.state.peakEquityUsd) {
      this.state.peakEquityUsd = this.state.currentEquityUsd;
    }
  }

  private drawdownPct(): number {
    if (this.state.peakEquityUsd <= 0) return 0;
    return Math.max(0, (this.state.peakEquityUsd - this.state.currentEquityUsd) / this.state.peakEquityUsd);
  }

  private async persistCalibration(
    pos: { id: string; symbol: string; venue: Venue; entryReason: Record<string, unknown> },
    closed: { pnlUsd: number; closedAt: number },
    win: boolean,
    entryGap: number,
  ): Promise<void> {
    const c = this.deps.config;
    const meta = pos.entryReason ?? {};
    const predictedRaw = Number(meta.validatorConfidence);
    const predicted = Number.isFinite(predictedRaw)
      ? Math.min(1, Math.max(0, predictedRaw))
      : 0;
    const outcome = win ? 1 : 0;
    const brier = (predicted - outcome) ** 2;
    const regime = typeof meta.regime === 'string' ? meta.regime : null;
    const tier = typeof meta.tier === 'string' ? meta.tier : null;

    const { error } = await getSupabase().from('coinarb_calibration').insert({
      user_id: c.userId,
      agent_id: c.agentId,
      position_id: pos.id,
      symbol: pos.symbol,
      venue: pos.venue,
      predicted_confidence: predicted,
      predicted_edge: entryGap > 0 ? entryGap : null,
      regime,
      tier,
      outcome,
      pnl_usd: closed.pnlUsd,
      brier_score: brier,
      closed_at: new Date(closed.closedAt).toISOString(),
    });
    if (error) console.warn('[loop-50x] calibration insert:', error.message);
  }

  private async persistRegimeSnapshot(
    next: RegimeState,
    prev: string | null,
    isTransition: boolean,
  ): Promise<void> {
    const c = this.deps.config;
    const { error } = await getSupabase().from('coinarb_regime_snapshots').insert({
      user_id: c.userId,
      agent_id: c.agentId,
      regime: next.regime,
      agent_multiplier: next.agentMultiplier,
      trend: next.trend,
      trend_strength: next.trendStrength,
      volatility_pct: next.volatilityPct,
      consistency_score: next.consistencyScore,
      previous_regime: prev,
      is_transition: isTransition,
    });
    if (error) console.warn('[loop-50x] regime snapshot insert:', error.message);
  }
}

export type { FiftyXParams };
