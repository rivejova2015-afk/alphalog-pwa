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
import { buildAllTimeframes, loadHistoricalCandles, mergeWithRealtimeCandles, type Candle } from '../analysis/candle-builder.js';
import { analyzeMtf } from '../analysis/mtf-analyzer.js';
import {
  evaluateConfluence,
  detectLiquiditySweep,
  validateChochDisplacement,
  evaluatePremiumDiscount,
  type SmcBias,
} from '../analysis/smc-detector.js';
import { refreshLiquidityMap } from '../analysis/liquidity-map.js';
import { checkFearGreed } from '../validators/fear-greed.js';
import { computeVolumeDelta, deltaAgreesWith } from '../validators/volume-delta.js';
import { computeVolumeProfile, priceInValueArea } from '../validators/volume-profile.js';
import { fetchLiquidationHeatmap } from '../validators/liquidation-heatmap.js';
import { fetchExchangeFlows } from '../validators/exchange-flows.js';
import { checkRiskReward } from '../math/kelly-sizer.js';
import { DecisionLogger } from '../ops/decision-logger.js';
import { CommandPoller } from '../ops/command-poller.js';
import { notify, formatEntry, formatExit, formatBreaker } from '../ops/notify-alphalog.js';
import { syncAgentHeartbeat } from '../ops/agent-heartbeat.js';
import { buildSmcSignalRow, persistSmcSignal } from '../ops/smc-signal-persist.js';
import { getSupabase } from '../supabase.js';
import {
  SYMBOLS, TIMEFRAMES, ARB_GAP_MIN_PCT, RR_MIN, LOOP_INTERVAL_MS, PAPER_MODE,
  MTF_CONFIDENCE_MIN, TRADING_PAUSED, COINARB_AGENT_ID, COINARB_USER_ID,
  type Symbol, type Timeframe,
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
  private readonly commandPoller = new CommandPoller();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private liquidityRefreshAt = 0;
  private historicalCandles: Map<string, Map<Timeframe, Candle[]>> = new Map();
  private historicalLoadedAt = 0;
  private historicalReloading = false;
  private readonly HIST_TTL_MS = 4 * 60 * 60 * 1000;

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
    this.commandPoller.start();
    console.log(`[loop] started — ${PAPER_MODE ? 'PAPER' : 'LIVE'} mode, ${LOOP_INTERVAL_MS}ms tick`);
    this.timer = setInterval(() => { void this.tick(); }, LOOP_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.commandPoller.stop();
    this.coinbase.stop();
    this.binance.stop();
    console.log('[loop] stopped');
  }

  private async ensureHistoricalCandles(): Promise<void> {
    const now = Date.now();
    const fresh = this.historicalLoadedAt > 0 && now - this.historicalLoadedAt < this.HIST_TTL_MS;
    if (fresh) return;

    // CAMBIO 3a/b/c — Stale-data background reload.
    // First load blocks (we need data to evaluate). Subsequent stale reloads run in
    // the background so the 15s tick isn't held up by a multi-second Coinbase REST burst.
    if (this.historicalReloading) return; // already in flight (covers both first-load and background)

    const isFirstLoad = this.historicalCandles.size === 0;
    if (isFirstLoad) {
      console.log('[loop] loading historical candles (first load — blocking)…');
      this.historicalReloading = true;
      try {
        await this.reloadHistorical();
      } finally {
        this.historicalReloading = false;
      }
      return;
    }

    this.historicalReloading = true;
    console.log('[loop] historical data stale — kicking off background reload…');
    void this.reloadHistorical()
      .catch(err => console.warn('[loop] background historical reload failed:', err))
      .finally(() => { this.historicalReloading = false; });
  }

  private async reloadHistorical(): Promise<void> {
    const start = Date.now();
    for (const symbol of SYMBOLS) {
      try {
        const hist = await loadHistoricalCandles(symbol, TIMEFRAMES);
        this.historicalCandles.set(symbol, hist);
      } catch (err) {
        console.warn(`[loop] historical load failed for ${symbol}:`, err);
      }
    }
    this.historicalLoadedAt = Date.now();
    console.log(`[loop] historical reload complete in ${Date.now() - start}ms`);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const tickStart = Date.now();
    let fgValue = 50;  // neutral default — kept fresh below; used by telemetry in finally even on early failure.

    try {
      await this.ensureHistoricalCandles();
      this.dailyTracker.rolloverIfNeeded();
      this.dailyTracker.setOpeningCapital(this.phaseManager.capitalNow, this.phaseManager.phaseName);

      await this.manageOpenPositions();

      // F&G is telemetry-only — never blocks entries, never accumulates into daily stats.
      // Price-action SMC handles direction; external sentiment indices add no edge here.
      const fg = await checkFearGreed();
      fgValue = fg.value;

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
        // CAMBIO 1b — Parallel symbol evaluation. With a 15s tick, sequential awaits
        // chew through the budget; allSettled keeps one slow symbol from blocking the rest.
        const evalStart = Date.now();
        const results = await Promise.allSettled(
          SYMBOLS.map(symbol => this.evaluateSymbol(symbol, fgValue)),
        );
        const evalMs = Date.now() - evalStart;
        const failed = results
          .map((r, i) => r.status === 'rejected' ? { symbol: SYMBOLS[i], reason: r.reason } : null)
          .filter((x): x is { symbol: Symbol; reason: unknown } => x !== null);
        if (failed.length > 0) {
          for (const f of failed) {
            console.error(`[loop] evaluateSymbol(${f.symbol}) rejected:`, f.reason);
          }
        }
        // CAMBIO 1c — Per-tick eval log so the dashboard tail shows which symbols
        // are firing and how long the cycle takes (target <2s on a 15s tick).
        const trades = this.dailyTracker.current.data.totalTrades;
        const counts = this.dailyTracker.getAllCountsBySymbol();
        const countsStr = SYMBOLS.map(s => `${s.split('-')[0]}=${counts[s] ?? 0}`).join(' ');
        console.log(`[loop] eval ${evalMs}ms | trades=${trades}/100 | ${countsStr} | failed=${failed.length}`);
      }

      await this.maybeRefreshLiquidity(tickStart);
    } catch (err) {
      console.error('[loop] tick failed:', err);
    } finally {
      // Heartbeat ALWAYS — even when the tick threw mid-pipeline. Dashboard staleness
      // had been masking healthy ticks because the telemetry upsert sat after the
      // throwing block instead of in finally.
      try {
        await this.flushTelemetry(fgValue);
        await this.dailyTracker.flush();
      } catch (err) {
        console.error('[loop] telemetry flush in finally failed:', err);
      }
    }
  }

  private async evaluateSymbol(symbol: Symbol, fearGreed: number): Promise<void> {
    // User-driven pause (Fase #10) — silent early-return so we don't spam
    // 17k SKIP rows/day. The flag flip is logged once by the command-poller,
    // and the paused state surfaces in algorithms.status via syncAlgorithmStatus.
    if (TRADING_PAUSED) return;

    // Daily caps (CAMBIO 2b) — per-symbol auto-stop avoids one pair eating the whole budget.
    if (this.dailyTracker.isTotalCapReached()) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `daily total cap reached (${this.dailyTracker.current.data.totalTrades}/100)`,
      });
      return;
    }
    if (this.dailyTracker.isSymbolCapReached(symbol)) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `symbol cap reached (${this.dailyTracker.getCountBySymbol(symbol)}/33)`,
      });
      return;
    }

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

    const realtimeCandles = buildAllTimeframes(cbSamples, TIMEFRAMES);
    const historicalForSymbol = this.historicalCandles.get(symbol) ?? new Map<Timeframe, Candle[]>();
    const candlesByTf = mergeWithRealtimeCandles(historicalForSymbol, realtimeCandles);
    const mtf = analyzeMtf(candlesByTf);

    if (mtf.bias === 'NEUTRAL' || mtf.confidence < MTF_CONFIDENCE_MIN) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `mtf bias=${mtf.bias} conf=${mtf.confidence.toFixed(2)} (need >=${MTF_CONFIDENCE_MIN.toFixed(2)} BUY/SELL)`,
        meta: { mtf: { bias: mtf.bias, confidence: mtf.confidence } },
      });
      return;
    }

    const htfBias = mtf.bias as SmcBias;
    const sig15m = mtf.perTimeframe.get('15M')!;
    const sig5m  = mtf.perTimeframe.get('5M')!;
    const sig1m  = mtf.perTimeframe.get('1M')!;

    // Best-effort analytics: record the 5m SMC signal that passed MTF threshold.
    // Skipped/failed signals already live in coinarb_decisions with their reject reason.
    if (COINARB_USER_ID) {
      void persistSmcSignal(
        getSupabase(),
        buildSmcSignalRow({
          userId: COINARB_USER_ID,
          agentId: COINARB_AGENT_ID,
          symbol,
          timeframe: '5M',
          signal: sig5m,
          price: cbPrice.last,
        }),
      ).catch((err) => console.warn(`[loop] smc signal persist failed (${symbol}):`, err));
    }

    const pd = evaluatePremiumDiscount(
      cbPrice.last,
      candlesByTf.get('1D') ?? [],
      candlesByTf.get('5M') ?? [],
      htfBias,
      sig1m,  // structural override: BOS/CHOCH on 1M lets EQUILIBRIUM+EQUILIBRIUM through
    );
    if (!pd.allowed) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `premium-discount: ${pd.reason}`,
        meta: { bias: htfBias, macroZone: pd.macroZone, microZone: pd.microZone },
      });
      return;
    }

    const sweep = detectLiquiditySweep(
      candlesByTf.get('5M') ?? [],
      candlesByTf.get('1M') ?? [],
      sig5m,
    );
    if (!sweep.detected) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `liquidity-sweep: not detected`,
        meta: { bias: htfBias },
      });
      return;
    }

    const choch = validateChochDisplacement(
      sig15m,
      sig5m,
      sig1m,
      htfBias,
      candlesByTf.get('1M') ?? [],
    );
    if (!choch.confirmed) {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `choch-displacement: ${choch.reason}`,
        meta: { bias: htfBias, ob1m: choch.ob1mAligned ? { low: choch.ob1mAligned.priceLow, high: choch.ob1mAligned.priceHigh } : null },
      });
      return;
    }

    const confluence = evaluateConfluence(sig15m, htfBias, this.dailyTracker.getPaceLastTwoHours());
    if (confluence.grade === 'NONE') {
      await this.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `confluence: NONE (need OB/FVG/EQ)`,
        meta: { bias: htfBias, pace2h: this.dailyTracker.getPaceLastTwoHours() },
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
    const sizeUsd = Math.min(riskUsd * 10 * confluence.kellyMultiplier, this.phaseManager.capitalNow * 0.5);
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
        this.dailyTracker.recordTrade(pos.symbol, pnlUsd, newCapital, newPhaseState.phase.name);

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

  private lastSyncedStatus: 'live' | 'paused' | null = null;

  private async syncAlgorithmStatus(supabase: ReturnType<typeof getSupabase>, paused: boolean): Promise<void> {
    // Sync algorithms.status with the bot's actual runtime state so the UI
    // doesn't lie. Only writes when status actually flips — a pasive bot
    // shouldn't churn updated_at every 15s.
    const desired: 'live' | 'paused' = paused ? 'paused' : 'live';
    if (desired === this.lastSyncedStatus) return;
    const { error } = await supabase
      .from('algorithms')
      .update({ status: desired, updated_at: new Date().toISOString() })
      .eq('id', COINARB_AGENT_ID);
    if (error) {
      console.warn(`[loop] algorithms.status sync failed:`, error.message);
      return;
    }
    this.lastSyncedStatus = desired;
    console.log(`[loop] algorithms.status -> ${desired}`);
  }

  private async flushTelemetry(fearGreed: number): Promise<void> {
    if (!COINARB_USER_ID) return;
    try {
      const supabase = getSupabase();
      const cbState = this.circuitBreaker.snapshot;
      const daily = this.dailyTracker.current.data;
      const btc = this.coinbase.getPrice('BTC');
      // Status sync — paused covers user pause, circuit pause, daily cap saturation.
      const paused =
        TRADING_PAUSED ||
        (cbState.pausedUntil !== null && cbState.pausedUntil > Date.now()) ||
        this.dailyTracker.isTotalCapReached();
      await this.syncAlgorithmStatus(supabase, paused);
      // CAMBIO 2c — per-symbol counts go in payload JSONB (no dedicated column).
      // daily_trades_count gets the DailyTracker total (source of truth for caps),
      // not the circuit-breaker counter (resets on circuit-pause).
      const tradesBySymbol = this.dailyTracker.getAllCountsBySymbol();
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
        daily_trades_count: daily.totalTrades,
        daily_wins: daily.wins,
        daily_losses: daily.losses,
        phase_current: this.phaseManager.phaseName,
        risk_pct_current: this.phaseManager.riskPct,
        capital_current: this.phaseManager.capitalNow,
        fear_greed_index: fearGreed,
        paused_until: cbState.pausedUntil ? new Date(cbState.pausedUntil).toISOString() : null,
        last_heartbeat_at: new Date().toISOString(),
        payload: {
          trades_by_symbol: tradesBySymbol,
          total_cap: 100,
          per_symbol_cap: 33,
        },
      }, { onConflict: 'agent_id' });
      // Mirror heartbeat to coinarb_agents (legacy table still consumed by
      // /intelligence/agents dashboard). Best-effort: errors logged, not thrown.
      const agentResult = await syncAgentHeartbeat(supabase, COINARB_USER_ID, paused);
      if (!agentResult.ok && agentResult.error !== 'no user_id') {
        console.warn('[loop] coinarb_agents heartbeat sync failed:', agentResult.error);
      }
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
