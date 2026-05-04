/**
 * Coinarb main loop — runs once per LOOP_INTERVAL_MS (60s default).
 *
 * Pipeline per tick (per symbol):
 *   1. Snapshot prices (Coinbase + Binance feeds), build candles for all 7 TFs
 *   2. SMC multi-timeframe analysis → bias + confidence
 *   3. Latency-arb gap (Coinbase vs Binance) → must exceed ARB_GAP_MIN_PCT
 *   4. Validators: F&G ≥65, volume-delta agrees with bias, vol profile in VA,
 *      liquidation-heatmap (stub), exchange-flows (stub)
 *   5. Risk gates: phase-manager riskUsd, circuit-breaker canTrade, R:R ≥ 2.0
 *   6. ENTER: place market order (paper or live), persist position
 *   7. Manage open positions (TP/SL hit detection on every tick)
 *   8. Telemetry upsert (heartbeat, ws status, phase, F&G, daily counters)
 */

import { CoinbaseFeed } from '../feeds/coinbase-ws.js';
import { BinanceFeed } from '../feeds/binance-ws.js';
import { CoinbaseSpotOrders } from '../trading/coinbase-spot-orders.js';
import { type CdpCredentials } from '../trading/coinbase-cdp-auth.js';
import { PaperSpotBroker } from '../paper/paper-spot-broker.js';
import { PhaseManager, computeRiskUsd } from '../risk/phase-manager.js';
import { CircuitBreaker } from '../risk/circuit-breaker.js';
import { DailyTracker } from '../risk/daily-tracker.js';
import { openPosition, closePosition, getOpenPositions, type OpenPositionRow } from '../trading/spot-positions.js';
import { buildAllTimeframes } from '../analysis/candle-builder.js';
import { analyzeMtf } from '../analysis/mtf-analyzer.js';
import { refreshLiquidityMap } from '../analysis/liquidity-map.js';
import { checkFearGreed } from '../validators/fear-greed.js';
import { computeVolumeDelta, deltaAgreesWith } from '../validators/volume-delta.js';
import { computeVolumeProfile, priceInValueArea } from '../validators/volume-profile.js';
import { fetchLiquidationHeatmap } from '../validators/liquidation-heatmap.js';
import { fetchExchangeFlows } from '../validators/exchange-flows.js';
import { checkRiskReward } from '../math/kelly-sizer.js';
import { DecisionLogger } from '../ops/decision-logger.js';
import { notify, formatEntry, formatExit, formatBreaker } from '../ops/notify-alphalog.js';
import { getSupabase } from '../supabase.js';
import {
  SYMBOLS, TIMEFRAMES, ARB_GAP_MIN_PCT, RR_MIN, LOOP_INTERVAL_MS, PAPER_MODE,
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
      } else if (!fg.allow) {
        await this.decisions.log({
          agentId: COINARB_AGENT_ID,
          userId: COINARB_USER_ID,
          kind: 'SKIP',
          venue: 'spot',
          reason: `F&G ${fg.value} < ${fg.threshold}`,
          meta: { fearGreed: fg },
        });
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
    const cbSamples = this.coinbase.getTimestampedSamples(base);
    const bnSamples = this.binance.getTimestampedSamples(base);
    if (cbSamples.length < 30 || bnSamples.length < 30) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `warming up (cb=${cbSamples.length}, bn=${bnSamples.length})`,
      });
      return;
    }

    const cbPrice = this.coinbase.getPrice(base);
    const bnPrice = this.binance.getPrice(base);
    if (!cbPrice || !bnPrice) return;

    const candlesByTf = buildAllTimeframes(cbSamples, TIMEFRAMES);
    const mtf = analyzeMtf(candlesByTf);

    if (mtf.bias === 'NEUTRAL' || mtf.confidence < 0.5) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `mtf bias=${mtf.bias} conf=${mtf.confidence.toFixed(2)} (need >=0.5 BUY/SELL)`,
        meta: { mtf: { bias: mtf.bias, confidence: mtf.confidence } },
      });
      return;
    }

    const arbGapPct = Math.abs(cbPrice.last - bnPrice.last) / bnPrice.last;
    const arbGapMin = ARB_GAP_MIN_PCT[symbol];
    if (arbGapPct < arbGapMin) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `arb gap ${arbGapPct.toFixed(5)} < ${arbGapMin.toFixed(5)}`,
        meta: { cb: cbPrice.last, bn: bnPrice.last },
      });
      return;
    }

    const volumeDelta = computeVolumeDelta(cbSamples);
    if (!deltaAgreesWith(mtf.bias as 'BUY' | 'SELL', volumeDelta.delta)) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `volume-delta ${volumeDelta.delta.toFixed(2)} disagrees with ${mtf.bias}`,
        meta: { volumeDelta },
      });
      return;
    }

    const vp = computeVolumeProfile(cbSamples);
    if (!priceInValueArea(cbPrice.last, vp)) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `price ${cbPrice.last} outside value area [${vp.valow}, ${vp.vahigh}]`,
      });
      return;
    }

    const [liqHeatmap, flows] = await Promise.all([
      fetchLiquidationHeatmap(symbol, cbPrice.last),
      fetchExchangeFlows(symbol),
    ]);

    const direction: 'BUY' | 'SELL' = mtf.bias as 'BUY' | 'SELL';
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

    const stopDistancePct = direction === 'BUY' ? 0.005 : 0.005;
    const stopLoss = direction === 'BUY' ? cbPrice.last * (1 - stopDistancePct) : cbPrice.last * (1 + stopDistancePct);
    const tpDistancePct = stopDistancePct * RR_MIN;
    const takeProfit = direction === 'BUY' ? cbPrice.last * (1 + tpDistancePct) : cbPrice.last * (1 - tpDistancePct);

    if (!checkRiskReward(cbPrice.last, stopLoss, takeProfit, RR_MIN)) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `R:R below ${RR_MIN}`,
      });
      return;
    }

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

    const liquidityZone = mtf.perTimeframe.get('15M')?.zones?.[0];
    const position = await openPosition({
      symbol,
      direction,
      entryPrice: fill.fillPrice,
      baseQty: fill.baseQty,
      sizeUsd,
      stopLoss,
      takeProfit,
      smcZoneType: liquidityZone?.type ?? 'none',
      smcZonePrice: liquidityZone ? (liquidityZone.priceLow + liquidityZone.priceHigh) / 2 : cbPrice.last,
      arbGapPct,
      fearGreedAtEntry: fearGreed,
      phaseAtEntry: this.phaseManager.phaseName,
      entryReason: {
        regime: mtf.bias,
        tier: tierFor(mtf.confidence),
        validatorConfidence: mtf.confidence,
        arbGapPct,
        volumeDelta: volumeDelta.delta,
        liqHeatmap: liqHeatmap.available,
        flows: flows.available,
      },
      feeUsd: fill.feeUsd,
      externalOrderId: fill.orderId,
    });

    await this.decisions.log({
      agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
      kind: 'ENTER', symbol, venue: 'spot',
      reason: `${direction} @${fill.fillPrice.toFixed(2)} size=$${sizeUsd.toFixed(2)} conf=${mtf.confidence.toFixed(2)}`,
      meta: {
        regime: mtf.bias, tier: tierFor(mtf.confidence),
        arbGapPct, fearGreed, phase: this.phaseManager.phaseName,
        positionId: position.id,
      },
    });

    notify({
      userId: COINARB_USER_ID,
      ...formatEntry({
        symbol, side: direction, filledPrice: fill.fillPrice, sizeUsd,
        reason: `${mtf.bias} conf=${mtf.confidence.toFixed(2)}`, paper: PAPER_MODE,
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
