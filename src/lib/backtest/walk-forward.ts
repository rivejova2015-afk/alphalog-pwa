import type { Bar, BacktestConfig, BacktestResult } from "@/types/backtest";
import { runBacktest } from "./engine";

export type WalkForwardMode = "rolling" | "anchored";

export interface WindowStats {
  sharpe: number;
  profitFactor: number;
  totalPnl: number;
  trades: number;
  winRate: number;
}

export interface WalkForwardWindow {
  index: number;
  inSampleFrom: string;
  inSampleTo: string;
  outOfSampleFrom: string;
  outOfSampleTo: string;
  is: WindowStats;
  oos: WindowStats;
  efficiency: number;
}

export interface ParameterStability {
  // Coefficient of variation of OOS performance across windows.
  oosSharpeCV: number;
  oosProfitFactorCV: number;
  // Sign consistency: fraction of windows where OOS PnL has same sign as overall mean.
  signConsistency: number;
  // Drift: linear regression slope of efficiency over time. Negative = decay.
  efficiencyDrift: number;
}

export interface WalkForwardResult {
  mode: WalkForwardMode;
  windows: WalkForwardWindow[];
  avgEfficiency: number;
  oosTotalPnl: number;
  isOverfit: boolean;
  stability: ParameterStability;
}

export async function runWalkForward(
  bars: Bar[],
  cfg: BacktestConfig,
  windows = 5,
  oosFraction = 0.3,
  mode: WalkForwardMode = "rolling",
): Promise<WalkForwardResult> {
  const out: WalkForwardWindow[] = [];
  const empty: ParameterStability = {
    oosSharpeCV: 0, oosProfitFactorCV: 0, signConsistency: 0, efficiencyDrift: 0,
  };
  if (bars.length < 200 || windows < 1) {
    return { mode, windows: out, avgEfficiency: 0, oosTotalPnl: 0, isOverfit: false, stability: empty };
  }

  const totalBars = bars.length;
  const windowSize = Math.floor(totalBars / windows);
  const oosSize = Math.max(50, Math.floor(windowSize * oosFraction));
  const isSize = windowSize - oosSize;

  let sumEff = 0;
  let oosTotalPnl = 0;

  for (let w = 0; w < windows; w++) {
    const wStart = mode === "anchored" ? 0 : w * windowSize;
    const wEnd = Math.min((w + 1) * windowSize, totalBars);
    if (wEnd - wStart < (mode === "anchored" ? windowSize : windowSize * 0.6)) break;

    const oosStart = wEnd - oosSize;
    const isSlice  = bars.slice(wStart, oosStart);
    const oosSlice = bars.slice(oosStart, wEnd);
    if (isSlice.length < (mode === "anchored" ? isSize : 50) || oosSlice.length < 30) continue;

    const isRes  = await runBacktest(isSlice,  cfg);
    const oosRes = await runBacktest(oosSlice, cfg);

    const eff = isRes.metrics.sharpe !== 0 ? oosRes.metrics.sharpe / isRes.metrics.sharpe : 0;
    sumEff += eff;
    oosTotalPnl += oosRes.metrics.totalPnl;

    out.push({
      index: w + 1,
      inSampleFrom:    isSlice[0].ts,
      inSampleTo:      isSlice[isSlice.length - 1].ts,
      outOfSampleFrom: oosSlice[0].ts,
      outOfSampleTo:   oosSlice[oosSlice.length - 1].ts,
      is:  pickStats(isRes),
      oos: pickStats(oosRes),
      efficiency: +eff.toFixed(3),
    });
  }

  const avgEff = out.length > 0 ? sumEff / out.length : 0;
  const stability = computeStability(out);

  return {
    mode,
    windows: out,
    avgEfficiency: +avgEff.toFixed(3),
    oosTotalPnl: +oosTotalPnl.toFixed(2),
    isOverfit: avgEff < 0.5,
    stability,
  };
}

function pickStats(r: BacktestResult): WindowStats {
  return {
    sharpe: r.metrics.sharpe,
    profitFactor: r.metrics.profitFactor,
    totalPnl: r.metrics.totalPnl,
    trades: r.metrics.totalTrades,
    winRate: r.metrics.winRate,
  };
}

function computeStability(windows: WalkForwardWindow[]): ParameterStability {
  if (windows.length < 2) return { oosSharpeCV: 0, oosProfitFactorCV: 0, signConsistency: 0, efficiencyDrift: 0 };
  const sharpes = windows.map((w) => w.oos.sharpe);
  const pfs = windows.map((w) => w.oos.profitFactor);
  const pnls = windows.map((w) => w.oos.totalPnl);
  const effs = windows.map((w) => w.efficiency);

  const cv = (xs: number[]) => {
    const m = xs.reduce((s, x) => s + x, 0) / xs.length;
    if (Math.abs(m) < 1e-9) return 0;
    let v = 0;
    for (const x of xs) v += (x - m) ** 2;
    v /= xs.length - 1;
    return Math.sqrt(v) / Math.abs(m);
  };

  const meanPnl = pnls.reduce((s, x) => s + x, 0) / pnls.length;
  const signSum = pnls.filter((p) => Math.sign(p) === Math.sign(meanPnl)).length;

  // simple linreg slope of efficiency over window index (drift)
  const n = effs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += effs[i]; sumXY += i * effs[i]; sumX2 += i * i;
  }
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) : 0;

  return {
    oosSharpeCV: +cv(sharpes).toFixed(3),
    oosProfitFactorCV: +cv(pfs).toFixed(3),
    signConsistency: +(signSum / pnls.length).toFixed(3),
    efficiencyDrift: +slope.toFixed(4),
  };
}
