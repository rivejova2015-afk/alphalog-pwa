/**
 * Coinarb main loop — runs once per LOOP_INTERVAL_MS (60s default).
 *
 * Pure SMC pipeline (no latency arb). Per tick (per symbol):
 *   1. Killzone gate (London 07-10 UTC, NY 13-16 UTC) — entries only
 *   2. Get current Coinbase price (skip with log if missing)
 *   3. Pull REST candle history (15M + 1H + 4H), seeded once per TF refresh
 *   4. SMC detector on 15M (entry TF) + 1H (confirmation TF)
 *   5. Premium/Discount filter on 4H — strict zone-side gate
 *   6. Liquidity-grab detector on 15M — needs EQH/EQL sweep + reject wick
 *   7. Direction confluence: grab.type matches 1H bias side
 *   8. Confidence ≥ SMC_CONF_MIN, R:R ≥ RR_MIN
 *   9. ENTER: stop = swept wick ± 0.1% buffer, TP = 2R structural
 *  10. Manage open positions (TP/SL hit detection on every tick, 24/7)
 *  11. Telemetry upsert (heartbeat, ws status, phase, daily counters)
 */

import { CoinbaseFeed } from '../feeds/coinbase-ws.js';
import { BinanceFeed } from '../feeds/binance-ws.js';
import { CoinbaseSpotOrders } from '../trading/coinbase-spot-orders.js';
import { type CdpCredentials } from '../trading/coinbase-cdp-auth.js';
import { PaperSpotBroker } from '../paper/paper-spot-broker.js';
import { PhaseManager, computeRiskUsd } from '../risk/phase-manager.js';
import { CircuitBreaker } from '../risk/circuit-breaker.js';
import { DailyTracker } from '../risk/daily-tracker.js';
import { inKillzone, currentKillzone } from '../risk/killzones.js';
import { openPosition, closePosition, getOpenPositions, type OpenPositionRow } from '../trading/spot-positions.js';
import { getCandlesForTimeframe } from '../analysis/candle-builder.js';
import { coinbaseRestHistory } from '../feeds/coinbase-rest-history.js';
import { detectSmc } from '../analysis/smc-detector.js';
import { detectLiquidityGrab, stopForGrab, type LiquidityGrab } from '../analysis/liquidity-grab.js';
import { computePremiumDiscount } from '../analysis/premium-discount.js';
import { refreshLiquidityMap } from '../analysis/liquidity-map.js';
import { checkFearGreed } from '../validators/fear-greed.js';
import { checkRiskReward } from '../math/kelly-sizer.js';
import { DecisionLogger } from '../ops/decision-logger.js';
import { notify, formatEntry, formatExit, formatBreaker } from '../ops/notify-alphalog.js';
import { getSupabase } from '../supabase.js';
import {
  SYMBOLS, RR_MIN, SMC_CONF_MIN, LOOP_INTERVAL_MS, PAPER_MODE,
  COINARB_AGENT_ID, COINARB_USER_ID, type Symbol,
} from './config.js';

const STARTING_CAPITAL = Number(process.env.COINARB_STARTING_CAPITAL ?? '100');
const SYMBOL_TO_BASE: Record<Symbol, 'BTC' | 'ETH' | 'SOL'> = {
  'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL',
};

export interface LoopDeps {
  coinbase: CoinbaseFeed;
  binance: BinanceFeed;
  liveOrders?: CoinbaseSpotOrders;
}

export class CoinarbLoop {
  private readonly coinbase: CoinbaseFeed;
  private readonly binance: BinanceFeed;
  private readonly liveOrders: CoinbaseSpotOrders | null;
  private readonly paperBroker: PaperSpotBroker;
  private readonly phaseManager: PhaseManager;
  private readonly circuitBreaker = new CircuitBreaker();
  private readonly dailyTracker = new DailyTracker();
  private readonly decisions = new DecisionLogger();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private liquidityRefreshAt = 0;

  constructor(deps: LoopDeps) {
    this.coinbase = deps.coinbase;
    this.binance = deps.binance;
    this.liveOrders = deps.liveOrders ?? null;
    this.paperBroker = new PaperSpotBroker(STARTING_CAPITAL);
    this.phaseManager = new PhaseManager(STARTING_CAPITAL);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.coinbase.start();
    this.binance.start();
    console.log(`[loop] started — ${PAPER_MODE ? 'PAPER' : 'LIVE'} mode, ${LOOP_INTERVAL_MS}ms tick`);
    void coinbaseRestHistory.warmup().catch((err) => {
      console.error('[loop] REST history warmup failed (will retry on tick):', err);
    });
    this.timer = setInterval(() => { void this.tick(); }, LOOP_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.coinbase.stop();
    this.binance.stop();
    console.log('[loop] stopped');
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const tickStart = Date.now();

    try {
      this.dailyTracker.rolloverIfNeeded();
      this.dailyTracker.setOpeningCapital(this.phaseManager.capitalNow, this.phaseManager.phaseName);

      await this.manageOpenPositions();

      const fg = await checkFearGreed();
      this.dailyTracker.recordFearGreed(fg.value);

      const circuitDecision = this.circuitBreaker.canTrade(tickStart);
      if (!circuitDecision.allow) {
        await this.decisions.log({
          agentId: COINARB_AGENT_ID,
          userId: COINARB_USER_ID,
          kind: 'BREAKER',
          venue: 'spot',
          reason: `circuit:${circuitDecision.reason}`,
          meta: this.circuitBreaker.snapshot,
        });
        if (!this.dailyTracker.current.data.circuitTriggered) {
          this.dailyTracker.markCircuitTriggered();
          notify({
            userId: COINARB_USER_ID,
            ...formatBreaker({ kind: circuitDecision.reason, message: `Trading paused (${circuitDecision.reason})`, paper: PAPER_MODE }),
          });
        }
      } else {
        for (const symbol of SYMBOLS) {
          await this.evaluateSymbol(symbol, fg.value);
        }
      }

      await this.maybeRefreshLiquidity(tickStart);
      await this.flushTelemetry(fg.value);
      await this.dailyTracker.flush();
    } catch (err) {
      console.error('[loop] tick failed:', err);
    }
  }

  private async evaluateSymbol(symbol: Symbol, fearGreed: number): Promise<void> {
    const base = SYMBOL_TO_BASE[symbol];

    // 1. Killzone gate — only open new entries during London + NY sessions
    const kz = currentKillzone();
    if (kz === 'NONE') {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: 'outside killzone (London 07-10 UTC, NY 13-16 UTC)',
      });
      return;
    }

    // 2. Current price
    const cbPrice = this.coinbase.getPrice(base);
    if (!cbPrice) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `no coinbase price for ${symbol}`,
      });
      return;
    }

    // 3. REST candle history for the three TFs we care about
    const [c15m, c1h, c4h] = await Promise.all([
      getCandlesForTimeframe(symbol, '15M'),
      getCandlesForTimeframe(symbol, '1H'),
      getCandlesForTimeframe(symbol, '4H'),
    ]);
    if (c15m.length < 13 || c1h.length < 13 || c4h.length < 10) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `insufficient history (15M=${c15m.length}, 1H=${c1h.length}, 4H=${c4h.length})`,
      });
      return;
    }

    // 4. SMC structure on 15M (entry) + 1H (confirmation)
    const smc15m = detectSmc(c15m);
    const smc1h = detectSmc(c1h);

    // 5. Premium/Discount filter on 4H
    const pd = computePremiumDiscount(c4h, cbPrice.last);
    if (!pd) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: 'premium/discount unavailable (insufficient 4H range)',
      });
      return;
    }

    // 6. Liquidity-grab detector on 15M
    const grab = detectLiquidityGrab(c15m, smc15m.zones);
    if (!grab) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `no liquidity grab on 15M (zones=${smc15m.zones.length})`,
        meta: { smc15mBias: smc15m.bias, smc15mConf: smc15m.confidence, pd: pd.zone },
      });
      return;
    }

    const direction: 'BUY' | 'SELL' = grab.type === 'BUY_GRAB' ? 'BUY' : 'SELL';

    // 7. Strict P/D gate
    if (direction === 'BUY' && pd.zone !== 'DISCOUNT') {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `BUY rejected: price ${cbPrice.last.toFixed(2)} not in DISCOUNT (zone=${pd.zone}, eq=${pd.equilibrium.toFixed(2)})`,
      });
      return;
    }
    if (direction === 'SELL' && pd.zone !== 'PREMIUM') {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `SELL rejected: price ${cbPrice.last.toFixed(2)} not in PREMIUM (zone=${pd.zone}, eq=${pd.equilibrium.toFixed(2)})`,
      });
      return;
    }

    // 8. 1H bias must agree (or be NEUTRAL — don't fight, but allow if no read)
    if (smc1h.bias !== 'NEUTRAL' && smc1h.bias !== direction) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `1H bias ${smc1h.bias} disagrees with grab direction ${direction}`,
      });
      return;
    }

    // 9. Confidence gate
    const confidence = grab.confidence;
    if (confidence < SMC_CONF_MIN) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `grab confidence ${confidence.toFixed(2)} < ${SMC_CONF_MIN}`,
      });
      return;
    }

    // 10. Risk sizing
    const riskUsd = computeRiskUsd(this.phaseManager.capitalNow, this.phaseManager.riskPct);
    const sizeUsd = Math.min(riskUsd * 10, this.phaseManager.capitalNow * 0.5);
    if (sizeUsd < 5) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `position size $${sizeUsd.toFixed(2)} below $5 minimum`,
      });
      return;
    }

    // 11. Structural stop = swept wick ± 0.1% buffer
    const stopLoss = stopForGrab(grab);
    const stopDistance = Math.abs(cbPrice.last - stopLoss);
    if (stopDistance / cbPrice.last < 0.0005) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `stop distance too small (${(stopDistance / cbPrice.last * 100).toFixed(3)}%) — likely stale grab`,
      });
      return;
    }

    // 12. TP = RR_MIN × stop distance, structural projection
    const takeProfit = direction === 'BUY'
      ? cbPrice.last + stopDistance * RR_MIN
      : cbPrice.last - stopDistance * RR_MIN;

    if (!checkRiskReward(cbPrice.last, stopLoss, takeProfit, RR_MIN)) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `R:R below ${RR_MIN}`,
      });
      return;
    }

    // 13. ENTER
    const fill = this.paperBroker.placeMarket({ symbol, side: direction, sizeUsd, markPrice: cbPrice.last });
    if (!fill) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: 'paper broker rejected fill (insufficient balance?)',
      });
      return;
    }

    if (!PAPER_MODE && this.liveOrders) {
      try {
        await this.liveOrders.placeLimit({
          productId: symbol,
          side: direction,
          baseSize: fill.baseQty.toFixed(8),
          limitPrice: cbPrice.last.toFixed(2),
          postOnly: false,
        });
      } catch (err) {
        console.error('[loop] live order failed, keeping paper fill record:', err);
      }
    }

    this.circuitBreaker.recordOpen();

    const position = await openPosition({
      symbol,
      direction,
      entryPrice: fill.fillPrice,
      baseQty: fill.baseQty,
      sizeUsd,
      stopLoss,
      takeProfit,
      smcZoneType: grab.zone.type,
      smcZonePrice: (grab.zone.priceLow + grab.zone.priceHigh) / 2,
      arbGapPct: 0,  // arb gate removed; column kept for schema compatibility
      fearGreedAtEntry: fearGreed,
      phaseAtEntry: this.phaseManager.phaseName,
      entryReason: {
        regime: smc1h.bias,
        tier: tierFor(confidence),
        validatorConfidence: confidence,
        grabType: grab.type,
        grabRejectionPct: grab.rejectionPct,
        sweptLevel: grab.sweptLevel,
        pdZone: pd.zone,
        equilibrium: pd.equilibrium,
        killzone: kz,
      },
      feeUsd: fill.feeUsd,
      externalOrderId: fill.orderId,
    });

    await this.decisions.log({
      agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
      kind: 'ENTER', symbol, venue: 'spot',
      reason: `${direction} @${fill.fillPrice.toFixed(2)} size=$${sizeUsd.toFixed(2)} conf=${confidence.toFixed(2)} grab=${grab.type} kz=${kz}`,
      meta: {
        regime: smc1h.bias, tier: tierFor(confidence),
        grabType: grab.type, sweptLevel: grab.sweptLevel,
        pdZone: pd.zone, killzone: kz,
        phase: this.phaseManager.phaseName,
        positionId: position.id,
      },
    });

    notify({
      userId: COINARB_USER_ID,
      ...formatEntry({
        symbol, side: direction, filledPrice: fill.fillPrice, sizeUsd,
        reason: `${grab.type} ${kz} conf=${confidence.toFixed(2)}`, paper: PAPER_MODE,
      }),
    });
  }

  private async manageOpenPositions(): Promise<void> {
    let openPositions: OpenPositionRow[];
    try {
      openPositions = await getOpenPositions();
    } catch (err) {
      console.error('[loop] getOpenPositions failed:', err);
      return;
    }

    for (const pos of openPositions) {
      const base = SYMBOL_TO_BASE[pos.symbol as Symbol];
      const cbPrice = this.coinbase.getPrice(base);
      if (!cbPrice) continue;
      const px = cbPrice.last;
      const dir = pos.direction as 'BUY' | 'SELL';

      let exitReason: 'TP' | 'SL' | null = null;
      if (dir === 'BUY') {
        if (px >= pos.take_profit_price) exitReason = 'TP';
        else if (px <= pos.stop_loss_price) exitReason = 'SL';
      } else {
        if (px <= pos.take_profit_price) exitReason = 'TP';
        else if (px >= pos.stop_loss_price) exitReason = 'SL';
      }
      if (!exitReason) continue;

      const closeFill = this.paperBroker.placeMarket({
        symbol: pos.symbol as Symbol,
        side: dir === 'BUY' ? 'SELL' : 'BUY',
        sizeUsd: pos.size_usd,
        markPrice: px,
      });
      const feeUsd = closeFill?.feeUsd ?? (pos.size_usd * 60) / 10_000;

      try {
        const { pnlUsd, pnlPct } = await closePosition({
          positionId: pos.id,
          exitPrice: px,
          exitReason,
          feeUsd,
          externalOrderId: closeFill?.orderId,
        });

        this.circuitBreaker.recordClose(pnlUsd);
        const newCapital = this.phaseManager.capitalNow + pnlUsd;
        const newPhaseState = await this.phaseManager.recordClose(newCapital);
        this.dailyTracker.recordTrade(pnlUsd, newCapital, newPhaseState.phase.name);

        await this.decisions.log({
          agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
          kind: 'EXIT', symbol: pos.symbol, venue: 'spot',
          reason: `${exitReason} @${px.toFixed(2)} pnl=$${pnlUsd.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
          meta: { positionId: pos.id, pnlUsd, pnlPct, newPhase: newPhaseState.phase.name, capitalAfter: newCapital },
        });

        notify({
          userId: COINARB_USER_ID,
          ...formatExit({
            symbol: pos.symbol, pnlUsd, pnlPercent: pnlPct, exitPrice: px,
            reason: exitReason, paper: PAPER_MODE,
          }),
        });
      } catch (err) {
        console.error(`[loop] closePosition ${pos.id} failed:`, err);
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

  private async flushTelemetry(fearGreed: number): Promise<void> {
    if (!COINARB_USER_ID) return;
    try {
      const supabase = getSupabase();
      const cbState = this.circuitBreaker.snapshot;
      const daily = this.dailyTracker.current.data;
      const btc = this.coinbase.getPrice('BTC');
      await supabase.from('coinarb_telemetry').upsert({
        user_id: COINARB_USER_ID,
        agent_id: COINARB_AGENT_ID,
        equity_usd: this.phaseManager.capitalNow,
        available_balance_usd: this.paperBroker.balanceUsd,
        open_positions_count: (await getOpenPositions().catch(() => [])).length,
        total_pnl_usd: daily.pnlUsd,
        win_rate: daily.totalTrades > 0 ? daily.wins / daily.totalTrades : null,
        ws_coinbase_connected: this.coinbase.isConnected,
        ws_binance_connected: this.binance.isConnected,
        ws_binance_connected_spot: this.binance.isConnected,
        btc_spot_price: btc?.last ?? null,
        consecutive_losses: cbState.consecutiveLosses,
        daily_trades_count: cbState.dailyTrades,
        daily_wins: daily.wins,
        daily_losses: daily.losses,
        phase_current: this.phaseManager.phaseName,
        risk_pct_current: this.phaseManager.riskPct,
        capital_current: this.phaseManager.capitalNow,
        fear_greed_index: fearGreed,
        paused_until: cbState.pausedUntil ? new Date(cbState.pausedUntil).toISOString() : null,
        last_heartbeat_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' });
    } catch (err) {
      console.error('[loop] telemetry flush failed:', err);
    }
  }
}

function tierFor(confidence: number): string {
  if (confidence >= 0.85) return 'A';
  if (confidence >= 0.70) return 'B';
  if (confidence >= 0.55) return 'C';
  return 'D';
}

export function buildLoop(creds?: CdpCredentials): CoinarbLoop {
  return new CoinarbLoop({
    coinbase: new CoinbaseFeed(),
    binance: new BinanceFeed(),
    liveOrders: !PAPER_MODE && creds ? new CoinbaseSpotOrders(creds) : undefined,
  });
}
