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
import {
  DEFAULT_DD_CONFIG,
  detectDdSignal,
  getDailyDirection,
  getDailyOpenFromCandles,
  utcDayStart,
  type DdDirection,
} from '../strategies/dd-daily-scalper.js';
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

  /**
   * Hook llamado después de cada cierre exitoso (TP o SL). Por default es
   * un no-op; runners que necesitan state extra al cierre (ej: DD trackea
   * consecutive losses para su killswitch diario) la overridean.
   */
  protected async onTradeClose(
    _ctx: EvaluationContext,
    _info: { symbol: Symbol; pnlUsd: number; exitReason: 'TP' | 'SL' },
  ): Promise<void> {
    // default no-op
  }

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

        try {
          await this.onTradeClose(ctx, {
            symbol: pos.symbol as Symbol,
            pnlUsd,
            exitReason,
          });
        } catch (hookErr) {
          console.error(`[regime-runner ${this.id}] onTradeClose hook threw:`, hookErr);
        }
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
    sizeUsdOverride?: number,
  ): Promise<boolean> {
    let sizeUsd: number;
    if (sizeUsdOverride !== undefined) {
      // Strategy DD (y futuras) calcula su propio size por risk-real
      // (riskUsd / sl_distance_pct) en lugar del cap fórmula heredada.
      sizeUsd = sizeUsdOverride;
    } else {
      const riskUsd = computeRiskUsd(ctx.phaseManager.capitalNow, ctx.phaseManager.riskPct);
      // Sizing: risk amount × R:R-implied multiplier, capped at half the pool
      // so a single bad fill can never blow capital below the next phase floor.
      sizeUsd = Math.min(riskUsd * 10, ctx.phaseManager.capitalNow * 0.5);
    }
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

/**
 * Daily Direction Scalper — id='DD'. Dispatched en TRENDING_HIGH/LOW +
 * RANGE_HIGH/LOW (todos los regímenes excepto DEAD). Diseñada por spec del
 * owner para ~100 ops/día con risk real 4% por trade, R:R 1.0, killswitch
 * 6 SL consecutivos → pausa hasta siguiente UTC 00:00.
 *
 * Estado runtime mantenido in-memory:
 *   - lastDirection[symbol]: para detectar flip y cerrar posiciones
 *   - flipCooldownUntil[symbol]: 10min post-flip
 *   - postTradeCooldownUntil[symbol]: 3min post-entry
 *   - consecutiveLossesToday: counter para killswitch
 *   - dayKillswitchUntil: ms; setea al siguiente UTC 00:00 cuando se gatilla
 *   - currentUtcDay: rollover marker
 */
export class DdRunner extends BaseRegimeRunner {
  readonly id: StrategyId = 'DD';

  // Constants spec del owner (no van a config.ts porque DD se opera entera
  // como block; ajustes runtime futuros podrían exponerlas a parameters).
  private static readonly RISK_PCT = 0.04;                  // 4% por trade
  private static readonly POST_TRADE_COOLDOWN_MS = 3 * 60_000;
  private static readonly FLIP_COOLDOWN_MS = 10 * 60_000;
  private static readonly MAX_CONSECUTIVE_LOSSES = 6;

  private readonly lastDirection = new Map<Symbol, DdDirection>();
  private readonly flipCooldownUntil = new Map<Symbol, number>();
  private readonly postTradeCooldownUntil = new Map<Symbol, number>();
  private consecutiveLossesToday = 0;
  private dayKillswitchUntil: number | null = null;
  private currentUtcDay = utcDayStart(Date.now());

  private rolloverIfNewDay(now: number): void {
    const day = utcDayStart(now);
    if (day !== this.currentUtcDay) {
      this.currentUtcDay = day;
      this.consecutiveLossesToday = 0;
      this.dayKillswitchUntil = null;
    }
  }

  async evaluateSymbol(symbol: Symbol, ctx: EvaluationContext): Promise<void> {
    if (!(await this.passesGates(symbol, ctx))) return;

    const now = Date.now();
    this.rolloverIfNewDay(now);

    // Killswitch del día (6 SLs consecutivos)
    if (this.dayKillswitchUntil !== null && now < this.dayKillswitchUntil) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `dd killswitch active (${DdRunner.MAX_CONSECUTIVE_LOSSES} SL consecutivos) hasta ${new Date(this.dayKillswitchUntil).toISOString()}`,
      });
      return;
    }

    // Cooldowns
    const flipUntil = this.flipCooldownUntil.get(symbol) ?? 0;
    if (now < flipUntil) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `flip cooldown ${Math.ceil((flipUntil - now) / 1000)}s remaining`,
      });
      return;
    }
    const postTradeUntil = this.postTradeCooldownUntil.get(symbol) ?? 0;
    if (now < postTradeUntil) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `post-trade cooldown ${Math.ceil((postTradeUntil - now) / 1000)}s remaining`,
      });
      return;
    }

    const tfs = ctx.historicalCandles.get(symbol);
    const candles1m: Candle[] = tfs?.get('1M') ?? [];

    // Flip detection: si la direction actual (basada en precio live) cambió
    // respecto del último tick, cerrar todas las posiciones DD abiertas
    // en ese símbolo y arrancar cooldown.
    if (candles1m.length > 0) {
      const dailyOpen = getDailyOpenFromCandles(candles1m, now);
      if (dailyOpen !== null) {
        const lastClose = candles1m[candles1m.length - 1].close;
        const currentDirection = getDailyDirection(
          lastClose,
          dailyOpen,
          DEFAULT_DD_CONFIG.directionThreshold,
        );
        const prevDirection = this.lastDirection.get(symbol);
        if (prevDirection !== undefined && prevDirection !== currentDirection) {
          // Direction flip detectado. Closeamos las DD positions abiertas
          // y arrancamos cooldown. No detectamos nuevo signal en este tick.
          await this.closeAllDdPositionsForSymbol(symbol, ctx);
          this.flipCooldownUntil.set(symbol, now + DdRunner.FLIP_COOLDOWN_MS);
          this.lastDirection.set(symbol, currentDirection);
          await ctx.decisions.log({
            agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
            kind: 'SKIP', symbol, venue: 'spot',
            reason: `direction flip ${prevDirection}→${currentDirection}; closed open positions, 10min cooldown`,
          });
          return;
        }
        this.lastDirection.set(symbol, currentDirection);
      }
    }

    const signal = detectDdSignal(candles1m, now);
    if (signal.side === null) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: signal.reason,
        meta: signal.meta,
      });
      return;
    }

    // Sizing override: risk real 4% del equity, sin cap del 50% del pool.
    const equity = ctx.phaseManager.capitalNow;
    const slDistancePct = Math.abs(signal.sl - signal.entryPrice) / signal.entryPrice;
    if (!Number.isFinite(slDistancePct) || slDistancePct <= 0) {
      await ctx.decisions.log({
        agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
        kind: 'SKIP', symbol, venue: 'spot',
        reason: `degenerate sl distance (${slDistancePct})`,
      });
      return;
    }
    const riskUsd = equity * DdRunner.RISK_PCT;
    const sizeUsd = riskUsd / slDistancePct;

    const opened = await this.openRegimePosition(
      symbol, signal.side, signal.entryPrice, signal.tp, signal.sl, ctx,
      {
        strategy: 'dd-daily-scalper',
        reason: signal.reason,
        extras: {
          rr: signal.rr,
          direction: signal.direction,
          riskPctNominal: DdRunner.RISK_PCT,
          riskUsdTarget: riskUsd,
          slDistancePct,
          ...signal.meta,
        },
      },
      sizeUsd,
    );

    if (opened) {
      this.postTradeCooldownUntil.set(symbol, now + DdRunner.POST_TRADE_COOLDOWN_MS);
    }
  }

  /**
   * Cierra todas las posiciones DD abiertas en `symbol`. Llamado desde
   * evaluateSymbol cuando se detecta flip de dirección. Reusa la lógica de
   * cierre del base runner (paper fill + persistencia + decisions log).
   */
  private async closeAllDdPositionsForSymbol(
    symbol: Symbol,
    ctx: EvaluationContext,
  ): Promise<void> {
    let openPositions;
    try {
      openPositions = await getOpenPositionsByStrategy(this.id);
    } catch (err) {
      console.error(`[regime-runner ${this.id}] getOpenPositions (flip-close) failed:`, err);
      return;
    }
    const SYMBOL_TO_BASE_LOCAL: Record<Symbol, 'BTC' | 'ETH' | 'SOL'> = {
      'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL',
    };
    for (const pos of openPositions) {
      if (pos.symbol !== symbol) continue;
      const base = SYMBOL_TO_BASE_LOCAL[symbol];
      const cbPrice = ctx.coinbase.getPrice(base);
      if (!cbPrice) continue;
      const px = cbPrice.last;
      const dir = pos.direction as 'BUY' | 'SELL';
      const closeFill = ctx.paperBroker.placeMarket({
        symbol,
        side: dir === 'BUY' ? 'SELL' : 'BUY',
        sizeUsd: pos.size_usd,
        markPrice: px,
      });
      const feeUsd = closeFill?.feeUsd ?? (pos.size_usd * 60) / 10_000;

      try {
        const { pnlUsd, pnlPct } = await closePosition({
          positionId: pos.id,
          exitPrice: px,
          exitReason: 'MANUAL',
          feeUsd,
          externalOrderId: closeFill?.orderId,
        });
        this.circuitBreaker.recordClose(pnlUsd);
        const newCapital = ctx.phaseManager.capitalNow + pnlUsd;
        const newPhaseState = await ctx.phaseManager.recordClose(newCapital);
        this.dailyTracker.recordTrade(symbol, pnlUsd, newCapital, newPhaseState.phase.name);

        await ctx.decisions.log({
          agentId: COINARB_AGENT_ID, userId: COINARB_USER_ID, strategyId: this.id,
          kind: 'EXIT', symbol, venue: 'spot',
          reason: `FLIP-CLOSE @${px.toFixed(2)} pnl=$${pnlUsd.toFixed(2)} (${pnlPct.toFixed(2)}%)`,
          meta: { positionId: pos.id, pnlUsd, pnlPct, exitReason: 'FLIP-CLOSE' },
        });
      } catch (err) {
        console.error(`[regime-runner ${this.id}] flip-close ${pos.id} failed:`, err);
      }
    }
  }

  /**
   * Hook llamado por BaseRegimeRunner.manageOpenPositions tras cada cierre
   * de TP o SL. DD trackea consecutive losses para el killswitch diario.
   */
  protected async onTradeClose(
    _ctx: EvaluationContext,
    info: { symbol: Symbol; pnlUsd: number; exitReason: 'TP' | 'SL' },
  ): Promise<void> {
    if (info.exitReason === 'TP') {
      this.consecutiveLossesToday = 0;
      return;
    }
    // SL: incrementar streak; si llega al cap, pausar hasta UTC 00:00 del
    // día siguiente.
    this.consecutiveLossesToday += 1;
    if (this.consecutiveLossesToday >= DdRunner.MAX_CONSECUTIVE_LOSSES) {
      const nextDay = utcDayStart(Date.now()) + 86_400_000;
      this.dayKillswitchUntil = nextDay;
      console.log(
        `[regime-runner ${this.id}] killswitch armed: ${this.consecutiveLossesToday} SLs ` +
        `consecutivos → pausa hasta ${new Date(nextDay).toISOString()}`,
      );
    }
  }
}
