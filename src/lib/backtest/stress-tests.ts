import type { Bar, BacktestConfig, BacktestMetrics } from '@/types/backtest';
import { runBacktest } from './engine';

export interface StressScenario {
  name: string;
  description: string;
  metrics: BacktestMetrics;
  pnlVsBaseline: number;     // delta vs baseline totalPnl
  sharpeVsBaseline: number;  // delta vs baseline sharpe
}

export interface StressTestResult {
  baseline: BacktestMetrics;
  scenarios: StressScenario[];
  worstScenario: string;
  resilient: boolean;        // all scenarios still profitable
}

export async function runStressTests(
  bars: Bar[],
  cfg: BacktestConfig,
  baseline: BacktestMetrics,
): Promise<StressTestResult> {
  const scenarios: StressScenario[] = [];

  const variants: { name: string; description: string; mutate: (c: BacktestConfig) => BacktestConfig }[] = [
    {
      name: 'spread_x2',
      description: 'Doubled spread (broker stress)',
      mutate: (c) => ({ ...c, spreadPoints: c.spreadPoints * 2 }),
    },
    {
      name: 'commission_plus_50',
      description: 'Commission +50%',
      mutate: (c) => ({ ...c, commissionPerLot: c.commissionPerLot * 1.5 }),
    },
    {
      name: 'slippage_x2',
      description: 'Doubled slippage',
      mutate: (c) => ({ ...c, slippagePoints: c.slippagePoints * 2 }),
    },
    {
      name: 'all_costs_x2',
      description: 'All trading costs doubled',
      mutate: (c) => ({
        ...c,
        spreadPoints: c.spreadPoints * 2,
        slippagePoints: c.slippagePoints * 2,
        commissionPerLot: c.commissionPerLot * 2,
      }),
    },
    {
      name: 'reduced_balance',
      description: 'Half initial balance',
      mutate: (c) => ({ ...c, initialBalance: c.initialBalance / 2 }),
    },
  ];

  for (const v of variants) {
    const cfgV = v.mutate(cfg);
    const res = await runBacktest(bars, cfgV);
    scenarios.push({
      name: v.name,
      description: v.description,
      metrics: res.metrics,
      pnlVsBaseline: +(res.metrics.totalPnl - baseline.totalPnl).toFixed(2),
      sharpeVsBaseline: +(res.metrics.sharpe - baseline.sharpe).toFixed(3),
    });
  }

  const winners = await runStressLoseTopWinners(bars, cfg, baseline);
  scenarios.push(winners);

  const worst = scenarios.reduce((w, s) => s.metrics.totalPnl < w.metrics.totalPnl ? s : w, scenarios[0]);
  const allProfitable = scenarios.every((s) => s.metrics.totalPnl > 0);

  return {
    baseline,
    scenarios,
    worstScenario: worst.name,
    resilient: allProfitable,
  };
}

async function runStressLoseTopWinners(
  bars: Bar[],
  cfg: BacktestConfig,
  baseline: BacktestMetrics,
): Promise<StressScenario> {
  const res = await runBacktest(bars, cfg);
  const sorted = [...res.trades].sort((a, b) => b.pnl - a.pnl);
  const top30Pct = Math.ceil(sorted.length * 0.3);
  const removed = new Set(sorted.slice(0, top30Pct).map((t) => t.id));
  const remaining = res.trades.filter((t) => !removed.has(t.id));
  const totalPnl = remaining.reduce((s, t) => s + t.pnl, 0);
  const wins = remaining.filter((t) => t.pnl > 0).length;
  const losses = remaining.filter((t) => t.pnl < 0).length;
  const winRate = remaining.length > 0 ? wins / remaining.length : 0;
  const grossWin = remaining.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(remaining.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;

  const synthetic: BacktestMetrics = {
    ...baseline,
    totalTrades: remaining.length,
    wins,
    losses,
    winRate: +winRate.toFixed(4),
    totalPnl: +totalPnl.toFixed(2),
    profitFactor: +profitFactor.toFixed(3),
  };

  return {
    name: 'lose_top_30pct_winners',
    description: 'Removed best 30% of trades (luck check)',
    metrics: synthetic,
    pnlVsBaseline: +(synthetic.totalPnl - baseline.totalPnl).toFixed(2),
    sharpeVsBaseline: 0,
  };
}
