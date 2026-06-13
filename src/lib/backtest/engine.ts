import type {
  Bar, BacktestConfig, BacktestResult, SimulatedTrade,
  EquityPoint, AlgorithmRules, Condition, IndicatorRef, Side,
} from '@/types/backtest';
import { sma, ema, rsi, atr, bbands } from './indicators';
import { computeMetrics } from './statistics';
import { computeSlippage, type SlippageParams } from './slippage';
import { buildBiasCache, multiTfBlocks, summarizeAlignment } from './multi-tf-filter';

interface IndicatorBundle {
  closes: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  cache: Map<string, number[]>;
  bbCache: Map<string, { upper: number[]; lower: number[] }>;
  bars: Bar[];
}

function buildBundle(bars: Bar[]): IndicatorBundle {
  return {
    bars,
    closes: bars.map((b) => b.close),
    opens:  bars.map((b) => b.open),
    highs:  bars.map((b) => b.high),
    lows:   bars.map((b) => b.low),
    cache: new Map(),
    bbCache: new Map(),
  };
}

function getSeries(bundle: IndicatorBundle, ref: IndicatorRef): number[] {
  const key = `${ref.type}_${ref.period ?? ''}_${ref.field ?? ''}`;
  const cached = bundle.cache.get(key);
  if (cached) return cached;
  let arr: number[];
  const src = ref.field === 'open' ? bundle.opens
            : ref.field === 'high' ? bundle.highs
            : ref.field === 'low'  ? bundle.lows
            : bundle.closes;
  switch (ref.type) {
    case 'sma':      arr = sma(src, ref.period ?? 14); break;
    case 'ema':      arr = ema(src, ref.period ?? 14); break;
    case 'rsi':      arr = rsi(src, ref.period ?? 14); break;
    case 'atr':      arr = atr(bundle.bars, ref.period ?? 14); break;
    case 'bb_upper': {
      const k = `bb_${ref.period ?? 20}`;
      let bb = bundle.bbCache.get(k);
      if (!bb) { const r = bbands(src, ref.period ?? 20); bb = { upper: r.upper, lower: r.lower }; bundle.bbCache.set(k, bb); }
      arr = bb.upper; break;
    }
    case 'bb_lower': {
      const k = `bb_${ref.period ?? 20}`;
      let bb = bundle.bbCache.get(k);
      if (!bb) { const r = bbands(src, ref.period ?? 20); bb = { upper: r.upper, lower: r.lower }; bundle.bbCache.set(k, bb); }
      arr = bb.lower; break;
    }
    case 'macd':     arr = ema(src, ref.period ?? 12); break;
    case 'price':    arr = src; break;
    default:         arr = bundle.closes;
  }
  bundle.cache.set(key, arr);
  return arr;
}

function valueAt(bundle: IndicatorBundle, ref: IndicatorRef | number, idx: number): number {
  if (typeof ref === 'number') return ref;
  const series = getSeries(bundle, ref);
  const i = idx - (ref.shift ?? 0);
  if (i < 0 || i >= series.length) return NaN;
  return series[i];
}

function evalCondition(bundle: IndicatorBundle, c: Condition, idx: number): boolean {
  const a = valueAt(bundle, c.left, idx);
  const b = valueAt(bundle, c.right, idx);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (c.op) {
    case '>':  return a > b;
    case '<':  return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '==': return a === b;
    case 'cross_above': {
      const ap = valueAt(bundle, c.left,  idx - 1);
      const bp = valueAt(bundle, c.right, idx - 1);
      return Number.isFinite(ap) && Number.isFinite(bp) && ap <= bp && a > b;
    }
    case 'cross_below': {
      const ap = valueAt(bundle, c.left,  idx - 1);
      const bp = valueAt(bundle, c.right, idx - 1);
      return Number.isFinite(ap) && Number.isFinite(bp) && ap >= bp && a < b;
    }
  }
}

function allConditions(bundle: IndicatorBundle, conds: Condition[] | undefined, idx: number): boolean {
  if (!conds || conds.length === 0) return false;
  return conds.every((c) => evalCondition(bundle, c, idx));
}

interface OpenPosition {
  side: Side;
  entryTs: string;
  entryIdx: number;
  entryPrice: number;
  lots: number;
  slPrice: number | null;
  tpPrice: number | null;
}

function calcLots(rules: AlgorithmRules, balance: number, slPoints: number | null, pointValue: number): number {
  const s = rules.sizing;
  if (s.mode === 'fixed_lot') return Math.max(0.01, s.value);
  if (s.mode === 'risk_pct') {
    if (!slPoints || slPoints <= 0) return 0.01;
    const riskUsd = balance * (s.value / 100);
    return Math.max(0.01, +(riskUsd / (slPoints * pointValue)).toFixed(2));
  }
  if (s.mode === 'kelly') return Math.max(0.01, s.value);
  return 0.01;
}

/**
 * Optional streaming hook for the core backtest loop. When passed, the engine
 * invokes `onProgress` every `progressEveryNBars` bars (default 50) with only
 * the *delta* of equity/trades produced since the previous call. Callers reuse
 * the snapshot to push SSE/Realtime updates to the UI so the equity curve
 * grows in real time instead of appearing at the end.
 *
 * When `onProgress` is undefined, the engine runs exactly as before — zero
 * overhead. The final BacktestResult shape is identical either way.
 *
 * The callback is awaited so back-pressure from a slow consumer (eg. SSE
 * client buffering) naturally throttles the engine.
 */
export interface RunBacktestOptions {
  onProgress?: (snapshot: BacktestProgressSnapshot) => void | Promise<void>;
  /** Default 50. Higher = less overhead, lower = smoother UI. Min 1. */
  progressEveryNBars?: number;
}

export interface BacktestProgressSnapshot {
  processedBars: number;
  totalBars: number;
  /** Equity points pushed since the previous callback (UI appends). */
  newEquity: EquityPoint[];
  /** Trades closed since the previous callback (UI appends). */
  newTrades: SimulatedTrade[];
}

export async function runBacktest(
  bars: Bar[],
  cfg: BacktestConfig,
  opts?: RunBacktestOptions,
): Promise<BacktestResult> {
  const start = Date.now();
  const bundle = buildBundle(bars);
  const rules = cfg.rules;
  const point = 1 / Math.pow(10, 5);
  const spreadCost = cfg.spreadPoints * point;
  const slipCost = cfg.slippagePoints * point;

  // Higher-TF trend filter (Plan v2 — Gap #4). Precomputed once because the
  // bias series is invariant of the primary loop. multiTfActive stays false
  // when the user didn't opt in OR run-job didn't hydrate the bars.
  const multiTfActive = cfg.useMultiTf === true
    && cfg.multiTfBars instanceof Map
    && cfg.multiTfBars.size > 0;
  const biasCache = multiTfActive ? buildBiasCache(cfg.multiTfBars!) : null;
  let tradesFilteredCount = 0;

  const slipParams: SlippageParams | null = cfg.slippageMode
    ? { mode: cfg.slippageMode, ...(cfg.slippageParams ?? {}) }
    : null;
  const dynamicSlip = (bar: Bar, side: Side, lots: number): number =>
    slipParams ? computeSlippage(bar, side, lots, slipParams) : slipCost;

  let balance = cfg.initialBalance;
  let peakEquity = balance;
  const equity: EquityPoint[] = [];
  const trades: SimulatedTrade[] = [];
  const open: OpenPosition[] = [];
  const maxConc = rules.maxConcurrent ?? 1;
  let tradeId = 0;

  // Streaming progress accounting. When `opts.onProgress` is undefined these
  // variables are still assigned but the conditional branch below skips any
  // work. The default `progressEveryNBars=50` is high enough that even a
  // 100k-bar backtest only invokes the callback ~2000 times — overhead
  // dominated by the `await` (~µs) when the consumer is synchronous.
  const progressEveryNBars = Math.max(1, opts?.progressEveryNBars ?? 50);
  let lastReportedEquityIdx = 0;
  let lastReportedTradesIdx = 0;

  const closePosition = (pos: OpenPosition, idx: number, exitPx: number, reason: SimulatedTrade['exitReason']) => {
    const pxDiff = pos.side === 'long' ? exitPx - pos.entryPrice : pos.entryPrice - exitPx;
    const grossPnl = pxDiff * pos.lots * cfg.contractSize;
    const commission = cfg.commissionPerLot * pos.lots * 2;
    const pnl = grossPnl - commission;
    balance += pnl;
    const t: SimulatedTrade = {
      id: ++tradeId,
      side: pos.side,
      entryTs: pos.entryTs,
      entryPrice: pos.entryPrice,
      exitTs: bars[idx].ts,
      exitPrice: exitPx,
      lots: pos.lots,
      slPrice: pos.slPrice,
      tpPrice: pos.tpPrice,
      pnl,
      pnlPct: cfg.initialBalance > 0 ? pnl / cfg.initialBalance : 0,
      bars: idx - pos.entryIdx,
      exitReason: reason,
    };
    trades.push(t);
  };

  for (let i = 50; i < bars.length; i++) {
    const bar = bars[i];

    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p];
      let closed = false;
      if (pos.side === 'long') {
        const exitSlip = dynamicSlip(bar, 'long', pos.lots);
        if (pos.slPrice && bar.low <= pos.slPrice)  { closePosition(pos, i, pos.slPrice - exitSlip, 'sl'); open.splice(p, 1); closed = true; }
        else if (pos.tpPrice && bar.high >= pos.tpPrice) { closePosition(pos, i, pos.tpPrice, 'tp'); open.splice(p, 1); closed = true; }
        else if (allConditions(bundle, rules.exitLong, i)) { closePosition(pos, i, bar.close - spreadCost - exitSlip, 'signal'); open.splice(p, 1); closed = true; }
      } else {
        const exitSlip = dynamicSlip(bar, 'short', pos.lots);
        if (pos.slPrice && bar.high >= pos.slPrice) { closePosition(pos, i, pos.slPrice + exitSlip, 'sl'); open.splice(p, 1); closed = true; }
        else if (pos.tpPrice && bar.low <= pos.tpPrice) { closePosition(pos, i, pos.tpPrice, 'tp'); open.splice(p, 1); closed = true; }
        else if (allConditions(bundle, rules.exitShort, i)) { closePosition(pos, i, bar.close + spreadCost + exitSlip, 'signal'); open.splice(p, 1); closed = true; }
      }
      if (closed && balance <= 0) {
        balance = 0;
        for (const stillOpen of open) closePosition(stillOpen, i, bar.close, 'margin');
        open.length = 0;
        break;
      }
    }

    if (open.length < maxConc) {
      const rawWantLong  = (cfg.direction === 'long'  || cfg.direction === 'both') && allConditions(bundle, rules.entryLong, i);
      const rawWantShort = (cfg.direction === 'short' || cfg.direction === 'both') && allConditions(bundle, rules.entryShort, i);
      let wantLong  = rawWantLong;
      let wantShort = rawWantShort;
      if (multiTfActive && biasCache) {
        if (rawWantLong  && multiTfBlocks('long',  bar.ts, biasCache)) { wantLong  = false; tradesFilteredCount++; }
        if (rawWantShort && multiTfBlocks('short', bar.ts, biasCache)) { wantShort = false; tradesFilteredCount++; }
      }
      if (wantLong) {
        const lots = calcLots(rules, balance, rules.slPoints ?? null, cfg.pointValue);
        const entryPx = bar.close + spreadCost + dynamicSlip(bar, 'long', lots);
        const slPx = rules.slPoints ? entryPx - rules.slPoints * point : null;
        const tpPx = rules.tpPoints ? entryPx + rules.tpPoints * point : null;
        open.push({ side: 'long', entryTs: bar.ts, entryIdx: i, entryPrice: entryPx, lots, slPrice: slPx, tpPrice: tpPx });
      } else if (wantShort) {
        const lots = calcLots(rules, balance, rules.slPoints ?? null, cfg.pointValue);
        const entryPx = bar.close - spreadCost - dynamicSlip(bar, 'short', lots);
        const slPx = rules.slPoints ? entryPx + rules.slPoints * point : null;
        const tpPx = rules.tpPoints ? entryPx - rules.tpPoints * point : null;
        open.push({ side: 'short', entryTs: bar.ts, entryIdx: i, entryPrice: entryPx, lots, slPrice: slPx, tpPrice: tpPx });
      }
    }

    let unreal = 0;
    for (const pos of open) {
      const diff = pos.side === 'long' ? bar.close - pos.entryPrice : pos.entryPrice - bar.close;
      unreal += diff * pos.lots * cfg.contractSize;
    }
    const equityNow = balance + unreal;
    if (equityNow > peakEquity) peakEquity = equityNow;
    const dd = peakEquity > 0 ? (peakEquity - equityNow) / peakEquity : 0;
    if (i % 20 === 0 || i === bars.length - 1) {
      equity.push({ ts: bar.ts, equity: +equityNow.toFixed(2), drawdown: +dd.toFixed(6) });
    }

    // Streaming snapshot — only emitted when caller opted in. Sends deltas so
    // the consumer (SSE encoder, Realtime writer) doesn't re-serialize the
    // whole equity/trades arrays on every tick.
    if (opts?.onProgress && i % progressEveryNBars === 0) {
      const newEquity = equity.slice(lastReportedEquityIdx);
      const newTrades = trades.slice(lastReportedTradesIdx);
      lastReportedEquityIdx = equity.length;
      lastReportedTradesIdx = trades.length;
      await opts.onProgress({
        processedBars: i,
        totalBars: bars.length,
        newEquity,
        newTrades,
      });
    }
  }

  for (const pos of open) {
    const last = bars[bars.length - 1];
    closePosition(pos, bars.length - 1, last.close, 'eod');
  }

  const metrics = computeMetrics(trades, equity, cfg.initialBalance);
  const result: BacktestResult = {
    metrics,
    trades,
    equityCurve: equity,
    finalBalance: balance,
    durationMs: Date.now() - start,
  };
  if (multiTfActive && biasCache) {
    result.multiTfStats = {
      tradesFilteredCount,
      alignment: summarizeAlignment(bars, biasCache),
    };
  }
  return result;
}
