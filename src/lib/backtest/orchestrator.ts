import type { Bar, BacktestConfig, BacktestResult } from '@/types/backtest';
import { runBacktest } from './engine';
import { runMonteCarlo, type MonteCarloResult } from './monte-carlo';
import { runWalkForward, type WalkForwardResult } from './walk-forward';
import { runStressTests, type StressTestResult } from './stress-tests';

export interface FullBacktestOutput {
  baseline: BacktestResult;
  monteCarlo: MonteCarloResult | null;
  walkForward: WalkForwardResult | null;
  stress: StressTestResult | null;
}

export interface PhaseProgress {
  phase: 'baseline' | 'monte_carlo' | 'walk_forward' | 'stress' | 'done';
  pct: number;
}

export async function runFullBacktest(
  bars: Bar[],
  cfg: BacktestConfig,
  onProgress?: (p: PhaseProgress) => Promise<void> | void,
): Promise<FullBacktestOutput> {
  await onProgress?.({ phase: 'baseline', pct: 5 });
  const baseline = await runBacktest(bars, cfg);
  await onProgress?.({ phase: 'baseline', pct: 25 });

  let monteCarlo: MonteCarloResult | null = null;
  if ((cfg.monteCarloIterations ?? 0) > 0 && baseline.trades.length > 0) {
    monteCarlo = runMonteCarlo(baseline.trades, cfg.initialBalance, cfg.monteCarloIterations);
    await onProgress?.({ phase: 'monte_carlo', pct: 50 });
  }

  let walkForward: WalkForwardResult | null = null;
  if ((cfg.walkForwardWindows ?? 0) > 0) {
    walkForward = await runWalkForward(bars, cfg, cfg.walkForwardWindows);
    await onProgress?.({ phase: 'walk_forward', pct: 75 });
  }

  let stress: StressTestResult | null = null;
  if (cfg.stressTests) {
    stress = await runStressTests(bars, cfg, baseline.metrics);
    await onProgress?.({ phase: 'stress', pct: 95 });
  }

  await onProgress?.({ phase: 'done', pct: 100 });
  return { baseline, monteCarlo, walkForward, stress };
}
