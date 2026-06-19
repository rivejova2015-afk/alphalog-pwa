/**
 * StrategyRunner — encapsulates one trading strategy's per-tick logic.
 *
 * The Coinarb coordinator owns the singletons (feeds, paper broker, capital
 * pool) and dispatches each tick to one or more runners. Each runner has its
 * own circuit-breaker and daily-tracker so a streak of losses on the
 * aggressive variant doesn't pause the conservative one. Trade attribution
 * goes through `strategy_id` (Fase 1) which is stamped on every decision,
 * position, and trade row this runner writes.
 *
 * Fase 2 wires the abstraction in with a single runner ('A', mode='smc')
 * that behaves identically to the pre-refactor monolithic loop. Fase 3 adds
 * the second runner ('B', mode='aggressive') plus the symbol mutex and the
 * global daily cap.
 */

import type { CoinbaseFeed } from '../feeds/coinbase-ws.js';
import type { BinanceFeed } from '../feeds/binance-ws.js';
import type { CoinbaseSpotOrders } from '../trading/coinbase-spot-orders.js';
import type { PaperSpotBroker } from '../paper/paper-spot-broker.js';
import { PhaseManager, computeRiskUsd } from '../risk/phase-manager.js';
import { CircuitBreaker } from '../risk/circuit-breaker.js';
import { DailyTracker } from '../risk/daily-tracker.js';
import {
  openPosition,
  closePosition,
  getOpenPositionsByStrategy,
  type OpenPositionRow,
  type StrategyId,
} from '../trading/spot-positions.js';
import { buildAllTimeframes, mergeWithRealtimeCandles, type Candle } from '../analysis/candle-builder.js';
import { analyzeMtf } from '../analysis/mtf-analyzer.js';
import {
  evaluateConfluence,
  detectLiquiditySweep,
  validateChochDisplacement,
  evaluatePremiumDiscount,
  type SmcBias,
} from '../analysis/smc-detector.js';
import { computeVolumeDelta, deltaAgreesWith } from '../validators/volume-delta.js';
import { computeVolumeProfile, priceInValueArea } from '../validators/volume-profile.js';
import { fetchLiquidationHeatmap } from '../validators/liquidation-heatmap.js';
import { fetchExchangeFlows } from '../validators/exchange-flows.js';
import { checkRiskReward } from '../math/kelly-sizer.js';
import { DecisionLogger } from '../ops/decision-logger.js';
import { notify, formatEntry, formatExit, formatBreaker } from '../ops/notify-alphalog.js';
import { buildSmcSignalRow, persistSmcSignal } from '../ops/smc-signal-persist.js';
import { getSupabase } from '../supabase.js';
import {
  ARB_GAP_MIN_PCT, RR_MIN, PAPER_MODE, MTF_CONFIDENCE_MIN, TRADING_PAUSED,
  COINARB_AGENT_ID, COINARB_USER_ID,
  type Symbol, type Timeframe,
} from './config.js';

export type StrategyMode = 'smc' | 'aggressive';

export interface StrategyRunnerOptions {
  id: StrategyId;
  mode: StrategyMode;
}

const SYMBOL_TO_BASE: Record<Symbol, 'BTC' | 'ETH' | 'SOL'> = {
  'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL',
};

/**
 * Shared resources the coordinator hands off to each runner at evaluation time.
 * Owned by the coordinator (one instance per bot process); runners hold only
 * read references.
 *
 * The cross-runner accessors (`getGlobalDailyEntryCount`,
 * `getGlobalDailyEntryCountBySymbol`, `isSymbolLockedByOtherStrategy`) let a
 * runner enforce limits that span every strategy in the process: a 100/day
 * global cap, a 33/symbol global cap, and a same-symbol mutex.
 */
export interface EvaluationContext {
  coinbase: CoinbaseFeed;
  binance: BinanceFeed;
  paperBroker: PaperSpotBroker;
  phaseManager: PhaseManager;
  liveOrders: CoinbaseSpotOrders | null;
  decisions: DecisionLogger;
  historicalCandles: Map<string, Map<Timeframe, Candle[]>>;
  fearGreed: number;
  /** Sum of entries today across every runner (Fase 3 cap=100/day global). */
  getGlobalDailyEntryCount(): number;
  /** Sum of entries today across runners for one symbol (Fase 3 cap=33/sym). */
  getGlobalDailyEntryCountBySymbol(symbol: Symbol): number;
  /** True if any OTHER strategy currently owns an OPEN position on this symbol. */
  isSymbolLockedByOtherStrategy(symbol: Symbol, byStrategy: StrategyId): Promise<boolean>;
}

function tierFor(confidence: number): string {
  if (confidence >= 0.85) return 'A';
  if (confidence >= 0.70) return 'B';
  if (confidence >= 0.55) return 'C';
  return 'D';
}

/**
 * Should the runner skip this symbol because the MTF bias gate fails?
 *
 * Conservative ('smc'): NEUTRAL OR confidence below floor → skip.
 * Aggressive ('aggressive'): only NEUTRAL → skip. The floor is ignored.
 *
 * Exported for unit testing.
 */
export function shouldSkipForMtfBias(
  mode: StrategyMode,
  bias: string,
  confidence: number,
  confidenceFloor: number,
): boolean {
  if (mode === 'aggressive') return bias === 'NEUTRAL';
  return bias === 'NEUTRAL' || confidence < confidenceFloor;
}

/**
 * Should the runner skip this symbol because one of the global caps was hit?
 *
 * The caps are shared across every runner in the process (Fase 3). Returns the
 * specific cap that tripped so the caller can log a clear reason.
 *
 * Exported for unit testing.
 */
export function shouldSkipForGlobalCaps(
  globalDailyCount: number,
  globalSymbolCount: number,
  totalCap: number,
  symbolCap: number,
): { skip: true; reason: 'global-daily' | 'global-symbol' } | { skip: false } {
  if (globalDailyCount >= totalCap) return { skip: true, reason: 'global-daily' };
  if (globalSymbolCount >= symbolCap) return { skip: true, reason: 'global-symbol' };
  return { skip: false };
}

/**
 * Should the runner evaluate the `liquidity-sweep` gate at all?
 *
 * Conservative mode requires sweep detection; aggressive skips the gate so it
 * never single-handedly blocks an entry.
 *
 * Exported for unit testing.
 */
export function shouldEvaluateLiquiditySweep(mode: StrategyMode): boolean {
  return mode !== 'aggressive';
}

export class StrategyRunner {
  readonly id: StrategyId;
  readonly mode: StrategyMode;
  readonly circuitBreaker = new CircuitBreaker();
  readonly dailyTracker = new DailyTracker();

  constructor(opts: StrategyRunnerOptions) {
    this.id = opts.id;
    this.mode = opts.mode;
  }

  /**
   * Run the per-tick evaluation for one symbol. Mirrors the pre-refactor
   * `loop.ts:evaluateSymbol` body, but routes circuit-breaker / daily-tracker
   * lookups through this runner's instance and tags every emitted decision /
   * position with this.id.
   */
  async evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void> {
    if (TRADING_PAUSED) return;

    if (this.dailyTracker.isTotalCapReached()) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `daily total cap reached (${this.dailyTracker.current.data.totalTrades}/100)`,
      });
      return;
    }
    if (this.dailyTracker.isSymbolCapReached(symbol)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `symbol cap reached (${this.dailyTracker.getCountBySymbol(symbol)}/33)`,
      });
      return;
    }

    // Fase 3 — global cap shared across runners. Without this every strategy
    // would get its own 100/day budget and we'd ship 200+ trades on a 2-runner
    // process. Same for the per-symbol cap.
    const globalEntries = ctx.getGlobalDailyEntryCount();
    const globalSymbolEntries = ctx.getGlobalDailyEntryCountBySymbol(symbol);
    const capCheck = shouldSkipForGlobalCaps(globalEntries, globalSymbolEntries, 100, 33);
    if (capCheck.skip) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: capCheck.reason === 'global-daily'
          ? `global daily cap reached (${globalEntries}/100)`
          : `global symbol cap reached (${globalSymbolEntries}/33)`,
      });
      return;
    }

    // Fase 3 — symbol mutex. If another runner already owns an OPEN position
    // on this symbol, skip. The first runner to enter the symbol holds it
    // until that position closes. Order of runner iteration in the coordinator
    // is deterministic (insertion order via Map), so 'A' has natural priority.
    if (await ctx.isSymbolLockedByOtherStrategy(symbol, this.id)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `symbol locked by other strategy`,
      });
      return;
    }

    const base = SYMBOL_TO_BASE[symbol];
    const cbSamples = ctx.coinbase.getTimestampedSamples(base);
    const bnSamples = ctx.binance.getTimestampedSamples(base);
    if (cbSamples.length < 30 || bnSamples.length < 30) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `warming up (cb=${cbSamples.length}, bn=${bnSamples.length})`,
      });
      return;
    }

    const cbPrice = ctx.coinbase.getPrice(base);
    const bnPrice = ctx.binance.getPrice(base);
    if (!cbPrice || !bnPrice) return;

    const realtimeCandles = buildAllTimeframes(cbSamples, ['1M', '5M', '15M', '1H', '4H', '1D']);
    const historicalForSymbol = ctx.historicalCandles.get(symbol) ?? new Map<Timeframe, Candle[]>();
    const candlesByTf = mergeWithRealtimeCandles(historicalForSymbol, realtimeCandles);
    const mtf = analyzeMtf(candlesByTf);

    if (shouldSkipForMtfBias(this.mode, mtf.bias, mtf.confidence, MTF_CONFIDENCE_MIN)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: this.mode === 'aggressive'
          ? `mtf bias=${mtf.bias} (aggressive needs non-NEUTRAL)`
          : `mtf bias=${mtf.bias} conf=${mtf.confidence.toFixed(2)} (need >=${MTF_CONFIDENCE_MIN.toFixed(2)} BUY/SELL)`,
        meta: { mtf: { bias: mtf.bias, confidence: mtf.confidence } },
      });
      return;
    }

    const htfBias = mtf.bias as SmcBias;
    const sig15m = mtf.perTimeframe.get('15M')!;
    const sig5m  = mtf.perTimeframe.get('5M')!;
    const sig1m  = mtf.perTimeframe.get('1M')!;

    if (COINARB_USER_ID) {
      void persistSmcSignal(
        getSupabase(),
        buildSmcSignalRow({
          userId: COINARB_USER_ID,
          agentId: COINARB_AGENT_ID,
          strategyId: this.id,
          symbol,
          timeframe: '5M',
          signal: sig5m,
          price: cbPrice.last,
        }),
      ).catch((err) => console.warn(`[strategy-runner ${this.id}] smc signal persist failed (${symbol}):`, err));
    }

    const pd = evaluatePremiumDiscount(
      cbPrice.last,
      candlesByTf.get('1D') ?? [],
      candlesByTf.get('5M') ?? [],
      htfBias,
      sig1m,
    );
    if (!pd.allowed) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `premium-discount: ${pd.reason}`,
        meta: { bias: htfBias, macroZone: pd.macroZone, microZone: pd.microZone },
      });
      return;
    }

    // Aggressive mode bypasses the liquidity-sweep gate entirely. Sweep is the
    // most restrictive of the 11 gates today (~80% of decisions skip here on
    // strategy A); strategy B relies on CHOCH + confluence + arb-gap for
    // quality instead.
    if (shouldEvaluateLiquiditySweep(this.mode)) {
      const sweep = detectLiquiditySweep(
        candlesByTf.get('5M') ?? [],
        candlesByTf.get('1M') ?? [],
        sig5m,
      );
      if (!sweep.detected) {
        await ctx.decisions.log({
          agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
          kind: 'SKIP', symbol, venue: 'spot',
          reason: `liquidity-sweep: not detected`,
          meta: { bias: htfBias },
        });
        return;
      }
    }

    const choch = validateChochDisplacement(
      sig15m,
      sig5m,
      sig1m,
      htfBias,
      candlesByTf.get('1M') ?? [],
    );
    if (!choch.confirmed) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `choch-displacement: ${choch.reason}`,
        meta: { bias: htfBias, ob1m: choch.ob1mAligned ? { low: choch.ob1mAligned.priceLow, high: choch.ob1mAligned.priceHigh } : null },
      });
      return;
    }

    const confluence = evaluateConfluence(sig15m, htfBias, this.dailyTracker.getPaceLastTwoHours());
    if (confluence.grade === 'NONE') {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `confluence: NONE (need OB/FVG/EQ)`,
        meta: { bias: htfBias, pace2h: this.dailyTracker.getPaceLastTwoHours() },
      });
      return;
    }

    const arbGapPct = Math.abs(cbPrice.last - bnPrice.last) / bnPrice.last;
    const arbGapMin = ARB_GAP_MIN_PCT[symbol];
    if (arbGapPct < arbGapMin) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `arb gap ${arbGapPct.toFixed(5)} < ${arbGapMin.toFixed(5)}`,
        meta: { cb: cbPrice.last, bn: bnPrice.last },
      });
      return;
    }

    const volumeDelta = computeVolumeDelta(cbSamples);
    if (!deltaAgreesWith(mtf.bias as 'BUY' | 'SELL', volumeDelta.delta)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `volume-delta ${volumeDelta.delta.toFixed(2)} disagrees with ${mtf.bias}`,
        meta: { volumeDelta },
      });
      return;
    }

    const vp = computeVolumeProfile(cbSamples);
    if (!priceInValueArea(cbPrice.last, vp)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
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
    const riskUsd = computeRiskUsd(ctx.phaseManager.capitalNow, ctx.phaseManager.riskPct);
    const sizeUsd = Math.min(riskUsd * 10 * confluence.kellyMultiplier, ctx.phaseManager.capitalNow * 0.5);
    if (sizeUsd < 5) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `position size $${sizeUsd.toFixed(2)} below $5 minimum`,
      });
      return;
    }

    const stopDistancePct = 0.005;
    const stopLoss = direction === 'BUY' ? cbPrice.last * (1 - stopDistancePct) : cbPrice.last * (1 + stopDistancePct);
    const tpDistancePct = stopDistancePct * RR_MIN;
    const takeProfit = direction === 'BUY' ? cbPrice.last * (1 + tpDistancePct) : cbPrice.last * (1 - tpDistancePct);

    if (!checkRiskReward(cbPrice.last, stopLoss, takeProfit, RR_MIN)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `R:R below ${RR_MIN}`,
      });
      return;
    }

    const fill = ctx.paperBroker.placeMarket({ symbol, side: direction, sizeUsd, markPrice: cbPrice.last });
    if (!fill) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: 'paper broker rejected fill (insufficient balance?)',
      });
      return;
    }

    if (!PAPER_MODE && ctx.liveOrders) {
      try {
        await ctx.liveOrders.placeLimit({
          productId: symbol,
          side: direction,
          baseSize: fill.baseQty.toFixed(8),
          limitPrice: cbPrice.last.toFixed(2),
          postOnly: false,
        });
      } catch (err) {
        console.error(`[strategy-runner ${this.id}] live order failed, keeping paper fill record:`, err);
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
      fearGreedAtEntry: ctx.fearGreed,
      phaseAtEntry: ctx.phaseManager.phaseName,
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
      strategyId: this.id,
    });

    await ctx.decisions.log({
      agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
      kind: 'ENTER', symbol, venue: 'spot',
      reason: `${direction} @${fill.fillPrice.toFixed(2)} size=$${sizeUsd.toFixed(2)} conf=${mtf.confidence.toFixed(2)}`,
      meta: {
        regime: mtf.bias, tier: tierFor(mtf.confidence),
        arbGapPct, fearGreed: ctx.fearGreed, phase: ctx.phaseManager.phaseName,
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

  /**
   * Close TP/SL hits for every open position owned by THIS strategy. Positions
   * opened by other runners are invisible from here — the coordinator never
   * shares them across runners.
   */
  async manageOpenPositions(ctx: EvaluationContext): Promise<void> {
    let openPositions: OpenPositionRow[];
    try {
      openPositions = await getOpenPositionsByStrategy(this.id);
    } catch (err) {
      console.error(`[strategy-runner ${this.id}] getOpenPositions failed:`, err);
      return;
    }

    for (const pos of openPositions) {
      const base = SYMBOL_TO_BASE[pos.symbol as Symbol];
      const cbPrice = ctx.coinbase.getPrice(base);
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

      const closeFill = ctx.paperBroker.placeMarket({
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
        const newCapital = ctx.phaseManager.capitalNow + pnlUsd;
        const newPhaseState = await ctx.phaseManager.recordClose(newCapital);
        this.dailyTracker.recordTrade(pos.symbol, pnlUsd, newCapital, newPhaseState.phase.name);

        await ctx.decisions.log({
          agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
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
        console.error(`[strategy-runner ${this.id}] closePosition ${pos.id} failed:`, err);
      }
    }
  }

  /**
   * Surface circuit-breaker trip notification. The coordinator calls this when
   * it gates the runner globally; the runner records the BREAKER decision +
   * sends the once-per-pause push.
   */
  async logCircuitTrip(ctx: EvaluationContext, reason: 'loss-streak' | 'daily-cap'): Promise<void> {
    await ctx.decisions.log({
      agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
      kind: 'BREAKER', venue: 'spot',
      reason: `circuit:${reason}`,
      meta: this.circuitBreaker.snapshot,
    });
    if (!this.dailyTracker.current.data.circuitTriggered) {
      this.dailyTracker.markCircuitTriggered();
      notify({
        userId: COINARB_USER_ID,
        ...formatBreaker({ kind: reason, message: `Trading paused (${reason}) — strategy ${this.id}`, paper: PAPER_MODE }),
      });
    }
  }
}
