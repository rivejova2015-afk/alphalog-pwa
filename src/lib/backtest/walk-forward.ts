import type { Bar, BacktestConfig, BacktestResult } from '@/types/backtest';
import { runBacktest } from './engine';

export interface WalkForwardWindow {
  index: number;
  inSampleFrom: string;
  inSampleTo: string;
  outOfSampleFrom: string;
  outOfSampleTo: string;
  is: { sharpe: number; profitFactor: number; totalPnl: number; trades: number; winRate: number };
  oos: { sharpe: number; profitFactor: number; totalPnl: number; trades: number; winRate: number };
  efficiency: number; // OOS Sharpe / IS Sharpe
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  avgEfficiency: number;
  oosTotalPnl: number;
  isOverfit: boolean;       // efficiency < 0.5
}

export async function runWalkForward(
  bars: Bar[],
  cfg: BacktestConfig,
  windows = 5,
  oosFraction = 0.3,
): Promise<WalkForwardResult> {
  const out: WalkForwardWindow[] = [];
  if (bars.length < 200 || windows < 1) {
    return { windows: out, avgEfficiency: 0, oosTotalPnl: 0, isOverfit: false };
  }

  const totalBars = bars.length;
  const windowSize = Math.floor(totalBars / windows);
  const oosSize = Math.max(50, Math.floor(windowSize * oosFraction));
  const isSize = windowSize - oosSize;

  let sumEff = 0;
  let oosTotalPnl = 0;

  for (let w = 0; w < windows; w++) {
    const wStart = w * windowSize;
    const wEnd = Math.min(wStart + windowSize, totalBars);
    if (wEnd - wStart < windowSize * 0.6) break;

    const isSlice  = bars.slice(wStart, wStart + isSize);
    const oosSlice = bars.slice(wStart + isSize, wEnd);
    if (isSlice.length < 50 || oosSlice.length < 30) continue;

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
  return {
    windows: out,
    avgEfficiency: +avgEff.toFixed(3),
    oosTotalPnl: +oosTotalPnl.toFixed(2),
    isOverfit: avgEff < 0.5,
  };
}

function pickStats(r: BacktestResult) {
  return {
    sharpe: r.metrics.sharpe,
    profitFactor: r.metrics.profitFactor,
    totalPnl: r.metrics.totalPnl,
    trades: r.metrics.totalTrades,
    winRate: r.metrics.winRate,
  };
}
