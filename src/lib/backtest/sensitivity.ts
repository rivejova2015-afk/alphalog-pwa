import type { Bar, BacktestConfig } from '@/types/backtest';
import { runBacktest } from './engine';

export type SweepAxis = 'slPoints' | 'tpPoints' | 'sizingValue';

export interface SensitivitySpec {
  xAxis: SweepAxis;
  xValues: number[];
  yAxis?: SweepAxis;
  yValues?: number[];
}

export interface SensitivityCell {
  x: number;
  y: number | null;
  totalPnl: number;
  sharpe: number;
  winRate: number;
  totalTrades: number;
  maxDrawdownPct: number;
}

export interface SensitivityResult {
  spec: SensitivitySpec;
  cells: SensitivityCell[];
  bestCell: SensitivityCell | null;
  worstCell: SensitivityCell | null;
}

function applyAxis(cfg: BacktestConfig, axis: SweepAxis, value: number): BacktestConfig {
  const next: BacktestConfig = JSON.parse(JSON.stringify(cfg));
  if (axis === 'slPoints') next.rules.slPoints = value;
  else if (axis === 'tpPoints') next.rules.tpPoints = value;
  else if (axis === 'sizingValue') next.rules.sizing = { ...next.rules.sizing, value };
  return next;
}

export async function runSensitivitySweep(
  bars: Bar[],
  cfg: BacktestConfig,
  spec: SensitivitySpec,
): Promise<SensitivityResult> {
  const cells: SensitivityCell[] = [];
  const ys = spec.yValues && spec.yAxis ? spec.yValues : [null];

  for (const y of ys) {
    for (const x of spec.xValues) {
      let trial = applyAxis(cfg, spec.xAxis, x);
      if (y !== null && spec.yAxis) trial = applyAxis(trial, spec.yAxis, y);
      const result = await runBacktest(bars, trial);
      const m = result.metrics;
      cells.push({
        x, y,
        totalPnl: m.totalPnl,
        sharpe: m.sharpe,
        winRate: m.winRate,
        totalTrades: m.totalTrades,
        maxDrawdownPct: m.maxDrawdownPct,
      });
    }
  }

  let best: SensitivityCell | null = null;
  let worst: SensitivityCell | null = null;
  for (const c of cells) {
    if (best === null || c.totalPnl > best.totalPnl) best = c;
    if (worst === null || c.totalPnl < worst.totalPnl) worst = c;
  }

  return { spec, cells, bestCell: best, worstCell: worst };
}
