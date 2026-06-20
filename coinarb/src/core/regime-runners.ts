/**
 * Regime-aware runners — Phase 2 of the multi-strategy restructure.
 *
 * Two new runner classes (`MeanRevRunner` and `MomentumRunner`) that share
 * the StrategyRunner contract (`evaluateSymbol` + `manageOpenPositions` +
 * `logCircuitTrip`) but delegate the entry-signal decision to the pure
 * detectors shipped in Phases 3 & 4:
 *
 *   MeanRevRunner   → detectMeanRevSignal(candles1H, candles15M)
 *                     id='M', dispatched when the regime is RANGE_LOW
 *   MomentumRunner  → detectMomentumSignal(candles5M)
 *                     id='P', dispatched when the regime is TRENDING_LOW
 *
 * Both runners reuse the shared helpers from the coordinator's
 * EvaluationContext: paperBroker for fills, phaseManager for capital,
 * spot-positions for persistence, decisionLogger for SKIP/ENTER rows.
 * They keep their own circuit-breaker and daily-tracker so a streak on
 * one strategy doesn't pause another.
 *
 * Position closing logic (TP/SL hit detection) is generic — copied from
 * StrategyRunner.manageOpenPositions verbatim and pulled into a shared
 * base class.
 */

import { CircuitBreaker } from '../risk/circuit-breaker.js';
import { DailyTracker } from '../risk/daily-tracker.js';
import { computeRiskUsd } from '../risk/phase-manager.js';
import {
  openPosition,
  closePosition,
  getOpenPositionsByStrategy,
  type StrategyId,
} from '../trading/spot-positions.js';
import type { Candle } from '../analysis/candle-builder.js';
import { detectMeanRevSignal } from '../strategies/mean-reversion.js';
import { detectMomentumSignal } from '../strategies/momentum-breakout.js';
import { notify, formatEntry, formatExit, formatBreaker } from '../ops/notify-alphalog.js';
import {
  PAPER_MODE, TRADING_PAUSED, COINARB_AGENT_ID, COINARB_USER_ID,
  type Symbol,
} from './config.js';
import type { EvaluationContext } from './strategy-runner.js';

const SYMBOL_TO_BASE: Record<Symbol, 'BTC' | 'ETH' | 'SOL'> = {
  'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL',
};

/**
 * Common contract every regime-runner implements. StrategyRunner satisfies it
 * structurally too — the coordinator can hold heterogeneous runners in a
 * single Map<StrategyId, RegimeRunner> and dispatch without type narrowing.
 */
export interface RegimeRunner {
  readonly id: StrategyId;
  readonly circuitBreaker: CircuitBreaker;
  readonly dailyTracker: DailyTracker;
  evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void>;
  manageOpenPositions(ctx: EvaluationContext): Promise<void>;
  logCircuitTrip(ctx: EvaluationContext, reason: 'loss-streak' | 'daily-cap'): Promise<void>;
}

/**
 * Shared base — `manageOpenPositions` and `logCircuitTrip` are identical
 * across SMC, mean-rev and momentum, so we factor them out. Subclasses only
 * implement `evaluateSymbol` and (optionally) tweak the entry sizing model.
 */
abstract class BaseRegimeRunner implements RegimeRunner {
  abstract readonly id: StrategyId;
  readonly circuitBreaker = new CircuitBreaker();
  readonly dailyTracker = new DailyTracker();

  abstract evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void>;

  async manageOpenPositions(ctx: EvaluationContext): Promise<void> {
    let openPositions;
    try {
      openPositions = await getOpenPositionsByStrategy(this.id);
    } catch (err) {
      console.error(`[regime-runner ${this.id}] getOpenPositions failed:`, err);
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
        console.error(`[regime-runner ${this.id}] closePosition ${pos.id} failed:`, err);
      }
    }
  }

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

  /**
   * Shared entry-side logic for regime runners: enforce caps + mutex, size
   * the position from phaseManager, place the fill on paperBroker (and live
   * orders if not paper), persist position + decision row, fire notification.
   *
   * Returns true if the position was opened, false if any gate blocked.
   */
  protected async openRegimePosition(
    symbol: Symbol,
    direction: 'BUY' | 'SELL',
    entryPrice: number,
    tp: number,
    sl: number,
    ctx: EvaluationContext,
    meta: { strategy: string; reason: string; extras?: Record<string, unknown> },
  ): Promise<boolean> {
    const riskUsd = computeRiskUsd(ctx.phaseManager.capitalNow, ctx.phaseManager.riskPct);
    // Sizing: risk amount × R:R-implied multiplier, capped at half the pool
    // so a single bad fill can never blow capital below the next phase floor.
    const sizeUsd = Math.min(riskUsd * 10, ctx.phaseManager.capitalNow * 0.5);
    if (sizeUsd < 5) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `position size $${sizeUsd.toFixed(2)} below $5 minimum`,
      });
      return false;
    }

    const fill = ctx.paperBroker.placeMarket({ symbol, side: direction, sizeUsd, markPrice: entryPrice });
    if (!fill) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: 'paper broker rejected fill (insufficient balance?)',
      });
      return false;
    }

    if (!PAPER_MODE && ctx.liveOrders) {
      try {
        await ctx.liveOrders.placeLimit({
          productId: symbol,
          side: direction,
          baseSize: fill.baseQty.toFixed(8),
          limitPrice: entryPrice.toFixed(2),
          postOnly: false,
        });
      } catch (err) {
        console.error(`[regime-runner ${this.id}] live order failed, keeping paper fill record:`, err);
      }
    }

    this.circuitBreaker.recordOpen();

    const position = await openPosition({
      symbol,
      direction,
      entryPrice: fill.fillPrice,
      baseQty: fill.baseQty,
      sizeUsd,
      stopLoss: sl,
      takeProfit: tp,
      smcZoneType: 'none',
      smcZonePrice: entryPrice,
      arbGapPct: 0,
      fearGreedAtEntry: ctx.fearGreed,
      phaseAtEntry: ctx.phaseManager.phaseName,
      entryReason: {
        strategy: meta.strategy,
        ...meta.extras,
      },
      feeUsd: fill.feeUsd,
      externalOrderId: fill.orderId,
      strategyId: this.id,
    });

    await ctx.decisions.log({
      agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
      kind: 'ENTER', symbol, venue: 'spot',
      reason: `${direction} @${fill.fillPrice.toFixed(2)} size=$${sizeUsd.toFixed(2)} — ${meta.reason}`,
      meta: {
        strategy: meta.strategy,
        positionId: position.id,
        ...meta.extras,
      },
    });

    notify({
      userId: COINARB_USER_ID,
      ...formatEntry({
        symbol,
        side: direction,
        filledPrice: fill.fillPrice,
        sizeUsd,
        reason: `${meta.strategy} · ${meta.reason}`,
        paper: PAPER_MODE,
      }),
    });
    return true;
  }

  /**
   * Shared pre-evaluation gates: TRADING_PAUSED, local caps, global caps,
   * symbol mutex. Returns true if all gates passed (caller should proceed
   * with signal detection). Returns false if any gate blocked and a SKIP
   * was logged.
   */
  protected async passesGates(symbol: Symbol, ctx: EvaluationContext): Promise<boolean> {
    if (TRADING_PAUSED) return false;

    if (this.dailyTracker.isTotalCapReached()) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `daily total cap reached (${this.dailyTracker.current.data.totalTrades}/100)`,
      });
      return false;
    }
    if (this.dailyTracker.isSymbolCapReached(symbol)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `symbol cap reached (${this.dailyTracker.getCountBySymbol(symbol)}/33)`,
      });
      return false;
    }

    const globalEntries = ctx.getGlobalDailyEntryCount();
    if (globalEntries >= 100) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `global daily cap reached (${globalEntries}/100)`,
      });
      return false;
    }
    const globalSymbolEntries = ctx.getGlobalDailyEntryCountBySymbol(symbol);
    if (globalSymbolEntries >= 33) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `global symbol cap reached (${globalSymbolEntries}/33)`,
      });
      return false;
    }

    if (await ctx.isSymbolLockedByOtherStrategy(symbol, this.id)) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `symbol locked by other strategy`,
      });
      return false;
    }

    return true;
  }
}

/**
 * Mean-reversion runner — id='M'. Dispatched when the regime is RANGE_LOW.
 * Delegates signal detection to `detectMeanRevSignal` (Phase 3) which reads
 * 1H candles for Bollinger Bands and 15M candles for RSI confirmation.
 */
export class MeanRevRunner extends BaseRegimeRunner {
  readonly id: StrategyId = 'M';

  async evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void> {
    if (!(await this.passesGates(symbol, ctx))) return;

    const tfs = ctx.historicalCandles.get(symbol);
    const candles1H = tfs?.get('1H') ?? [];
    const candles15M = tfs?.get('15M') ?? [];

    const signal = detectMeanRevSignal(candles1H, candles15M);
    if (signal.side === null) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: signal.reason,
        meta: signal.meta,
      });
      return;
    }

    await this.openRegimePosition(
      symbol, signal.side, signal.entryPrice, signal.tp, signal.sl, ctx,
      {
        strategy: 'mean-rev',
        reason: signal.reason,
        extras: { rr: signal.rr, ...signal.meta },
      },
    );
  }
}

/**
 * Momentum-breakout runner — id='P'. Dispatched when the regime is
 * TRENDING_LOW. Single-TF on 5M (per the Phase 4 design): EMA stack + ADX +
 * volume surge + swing-anchored SL.
 */
export class MomentumRunner extends BaseRegimeRunner {
  readonly id: StrategyId = 'P';

  async evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void> {
    if (!(await this.passesGates(symbol, ctx))) return;

    const tfs = ctx.historicalCandles.get(symbol);
    const candles5M: Candle[] = tfs?.get('5M') ?? [];

    const signal = detectMomentumSignal(candles5M);
    if (signal.side === null) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: signal.reason,
        meta: signal.meta,
      });
      return;
    }

    await this.openRegimePosition(
      symbol, signal.side, signal.entryPrice, signal.tp, signal.sl, ctx,
      {
        strategy: 'momentum',
        reason: signal.reason,
        extras: { rr: signal.rr, ...signal.meta },
      },
    );
  }
}
