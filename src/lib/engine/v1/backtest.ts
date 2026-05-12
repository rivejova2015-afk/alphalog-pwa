// In-memory backtest for Base Engine v1.
//
// Walks the smallest configured timeframe bar-by-bar. At each bar:
//   1. Builds barsByTf with every TF's history truncated to ts <= now.
//   2. Calls evaluateEngineV1 to get a SignalResult.
//   3. Simulates an entry/exit using SL/TP from algorithm.parameters
//      (or sensible defaults: 1 ATR(14) SL, 2 ATR(14) TP).
//   4. Aggregates trades + equity curve.
//   5. computeMetrics returns the same BacktestMetrics shape as the existing
//      backtest engine, so downstream UI / robustness can reuse it.

import type { Bar, SimulatedTrade, EquityPoint, BacktestResult, Side } from "@/types/backtest";
import { computeMetrics } from "@/lib/backtest/statistics";
import { atr } from "@/lib/backtest/indicators";
import { evaluateEngineV1, type EvaluatorAlgorithm } from "./evaluator";
import { extractMultiTf } from "./index";
import type { BarsByTf, MultiTfConfig } from "./types";

const STARTING_EQUITY = 10_000;
const DEFAULT_ATR_PERIOD = 14;
const DEFAULT_SL_MULT = 1.5;
const DEFAULT_TP_MULT = 3.0;
const POINT_VALUE = 10;          // $10 per point per 1.0 lot (XAUUSD-ish default)

interface OpenPosition {
  side: Side;
  entryTs: string;
  entryIdx: number;
  entryPrice: number;
  lots: number;
  slPrice: number;
  tpPrice: number;
}

export interface SimulationOpts {
  symbol: string;
  algorithm: EvaluatorAlgorithm;
  // smallestTf is the bar stream we walk (e.g., "M15"). Other TFs are
  // referenced as context windows truncated to each step.
  smallestTf?: string;
  // Bars indexed by timeframe, chronological order (oldest → newest).
  barsByTf: BarsByTf;
  // Optional overrides
  startingEquity?: number;
  slAtrMult?: number;
  tpAtrMult?: number;
}

function tfMinutes(tf: string): number {
  switch (tf) {
    case "M1":  return 1;
    case "M5":  return 5;
    case "M15": return 15;
    case "M30": return 30;
    case "H1":  return 60;
    case "H4":  return 240;
    case "D1":  return 1440;
    case "W1":  return 10080;
    case "MN1": return 43200;
    default:    return 15;
  }
}

// Slice each TF's bars to the latest bar whose ts <= cutoffTs.
function buildContext(barsByTf: BarsByTf, cutoffTs: string, mtf: MultiTfConfig): BarsByTf {
  const out: BarsByTf = new Map();
  const cutoff = new Date(cutoffTs).getTime();
  for (const t of mtf.timeframes) {
    const all = barsByTf.get(t.tf) ?? [];
    let upTo = 0;
    // Bars are chronological — binary search would be nicer but linear is fine for backtests.
    for (let i = 0; i < all.length; i++) {
      if (new Date(all[i].ts).getTime() <= cutoff) upTo = i + 1;
      else break;
    }
    out.set(t.tf, all.slice(0, upTo));
  }
  return out;
}

function computeBreakerState(
  cfg: EvaluatorAlgorithm["engine_config"],
  trades: SimulatedTrade[],
  equity: number,
  nowTs: string,
): { tripped: boolean; reason?: string } {
  const breaker = cfg?.modules?.circuit_breaker;
  if (!breaker?.enabled) return { tripped: false };
  if (trades.length === 0) return { tripped: false };

  const now = new Date(nowTs).getTime();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  let consec = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i].pnl < 0) consec++;
    else break;
  }
  if (consec >= breaker.consecutive_losses) {
    return { tripped: true, reason: `consecutive_losses:${consec}` };
  }

  let daily = 0;
  let weekly = 0;
  for (const t of trades) {
    const ts = new Date(t.exitTs).getTime();
    if (ts >= weekAgo) weekly += t.pnl;
    if (ts >= dayAgo) daily += t.pnl;
  }
  const safe = Math.max(1, equity);
  if ((daily / safe) * 100 < -breaker.daily_dd_pct) {
    return { tripped: true, reason: `daily_dd:${((daily / safe) * 100).toFixed(2)}%` };
  }
  if ((weekly / safe) * 100 < -breaker.weekly_dd_pct) {
    return { tripped: true, reason: `weekly_dd:${((weekly / safe) * 100).toFixed(2)}%` };
  }
  return { tripped: false };
}

export async function simulateEngineV1(opts: SimulationOpts): Promise<BacktestResult> {
  const start = Date.now();
  const { algorithm, barsByTf, symbol } = opts;
  const mtf = extractMultiTf(algorithm.parameters);

  // Pick the smallest TF as the driving series.
  const smallestTf = opts.smallestTf ?? mtf.timeframes
    .slice()
    .sort((a, b) => tfMinutes(a.tf) - tfMinutes(b.tf))[0].tf;

  const driver = barsByTf.get(smallestTf) ?? [];
  if (driver.length < 200) {
    return {
      metrics: computeMetrics([], [], opts.startingEquity ?? STARTING_EQUITY),
      trades: [],
      equityCurve: [],
      finalBalance: opts.startingEquity ?? STARTING_EQUITY,
      durationMs: Date.now() - start,
    };
  }

  const initialEquity = opts.startingEquity ?? STARTING_EQUITY;
  let balance = initialEquity;
  let peakEquity = balance;
  const equity: EquityPoint[] = [];
  const trades: SimulatedTrade[] = [];
  const open: OpenPosition[] = [];
  let tradeId = 0;

  const slAtrMult = opts.slAtrMult ?? DEFAULT_SL_MULT;
  const tpAtrMult = opts.tpAtrMult ?? DEFAULT_TP_MULT;

  // Pre-compute ATR(14) on the driver stream so we can size stops at each entry.
  const atrSeries = atr(driver, DEFAULT_ATR_PERIOD);

  for (let i = 200; i < driver.length; i++) {
    const bar = driver[i];

    // 1. Manage open positions (SL/TP hit?)
    for (let p = open.length - 1; p >= 0; p--) {
      const pos = open[p];
      let exitPx: number | null = null;
      let reason: SimulatedTrade["exitReason"] = "signal";
      if (pos.side === "long") {
        if (bar.low <= pos.slPrice) { exitPx = pos.slPrice; reason = "sl"; }
        else if (bar.high >= pos.tpPrice) { exitPx = pos.tpPrice; reason = "tp"; }
      } else {
        if (bar.high >= pos.slPrice) { exitPx = pos.slPrice; reason = "sl"; }
        else if (bar.low <= pos.tpPrice) { exitPx = pos.tpPrice; reason = "tp"; }
      }
      if (exitPx != null) {
        const pxDiff = pos.side === "long" ? exitPx - pos.entryPrice : pos.entryPrice - exitPx;
        const pnl = pxDiff * pos.lots * POINT_VALUE;
        balance += pnl;
        trades.push({
          id: ++tradeId,
          side: pos.side,
          entryTs: pos.entryTs,
          entryPrice: pos.entryPrice,
          exitTs: bar.ts,
          exitPrice: exitPx,
          lots: pos.lots,
          slPrice: pos.slPrice,
          tpPrice: pos.tpPrice,
          pnl,
          pnlPct: initialEquity > 0 ? pnl / initialEquity : 0,
          bars: i - pos.entryIdx,
          exitReason: reason,
        });
        open.splice(p, 1);
      }
    }

    // 2. Evaluate engine for entry (only if no open position — single concurrent).
    if (open.length === 0) {
      const ctx = buildContext(barsByTf, bar.ts, mtf);
      const breakerState = computeBreakerState(algorithm.engine_config, trades, balance, bar.ts);
      const signal = evaluateEngineV1(
        algorithm,
        { now: new Date(bar.ts), symbol, currentEquity: balance, baseLots: algorithm.lot_size ?? 0.01 },
        mtf,
        ctx,
        breakerState,
      );

      if (signal.action !== "HOLD") {
        const atrLast = atrSeries[i];
        if (Number.isFinite(atrLast) && atrLast > 0) {
          const side: Side = signal.action === "BUY" ? "long" : "short";
          const entryPrice = bar.close;
          const slPrice = side === "long" ? entryPrice - atrLast * slAtrMult : entryPrice + atrLast * slAtrMult;
          const tpPrice = side === "long" ? entryPrice + atrLast * tpAtrMult : entryPrice - atrLast * tpAtrMult;
          open.push({
            side,
            entryTs: bar.ts,
            entryIdx: i,
            entryPrice,
            lots: signal.lots,
            slPrice,
            tpPrice,
          });
        }
      }
    }

    // 3. Mark-to-market equity sample (every 20 bars).
    let unreal = 0;
    for (const pos of open) {
      const diff = pos.side === "long" ? bar.close - pos.entryPrice : pos.entryPrice - bar.close;
      unreal += diff * pos.lots * POINT_VALUE;
    }
    const equityNow = balance + unreal;
    if (equityNow > peakEquity) peakEquity = equityNow;
    const dd = peakEquity > 0 ? (peakEquity - equityNow) / peakEquity : 0;
    if (i % 20 === 0 || i === driver.length - 1) {
      equity.push({ ts: bar.ts, equity: +equityNow.toFixed(2), drawdown: +dd.toFixed(6) });
    }
  }

  // Close any remaining positions at the last bar.
  const last = driver[driver.length - 1];
  for (const pos of open) {
    const pxDiff = pos.side === "long" ? last.close - pos.entryPrice : pos.entryPrice - last.close;
    const pnl = pxDiff * pos.lots * POINT_VALUE;
    balance += pnl;
    trades.push({
      id: ++tradeId,
      side: pos.side,
      entryTs: pos.entryTs,
      entryPrice: pos.entryPrice,
      exitTs: last.ts,
      exitPrice: last.close,
      lots: pos.lots,
      slPrice: pos.slPrice,
      tpPrice: pos.tpPrice,
      pnl,
      pnlPct: initialEquity > 0 ? pnl / initialEquity : 0,
      bars: driver.length - 1 - pos.entryIdx,
      exitReason: "eod",
    });
  }

  const metrics = computeMetrics(trades, equity, initialEquity);
  return {
    metrics,
    trades,
    equityCurve: equity,
    finalBalance: balance,
    durationMs: Date.now() - start,
  };
}

// Helper: load bars from an array of (tf, bars) pairs and run the sim.
// Public-facing convenience for the API route below.
export async function simulateEngineV1FromBars(
  algorithm: EvaluatorAlgorithm,
  symbol: string,
  bars: { tf: string; bars: Bar[] }[],
  opts: { startingEquity?: number; slAtrMult?: number; tpAtrMult?: number } = {},
): Promise<BacktestResult> {
  const map: BarsByTf = new Map();
  for (const e of bars) map.set(e.tf, e.bars);
  return simulateEngineV1({
    algorithm,
    symbol,
    barsByTf: map,
    ...opts,
  });
}
