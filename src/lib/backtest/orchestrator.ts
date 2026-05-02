import type { Bar, BacktestConfig, BacktestResult } from '@/types/backtest';
import { runBacktest } from './engine';
import { runMonteCarlo, type MonteCarloResult } from './monte-carlo';
import { runWalkForward, type WalkForwardResult } from './walk-forward';
import { runStressTests, type StressTestResult } from './stress-tests';
import { classifyRegimes, regimePerformance, type RegimePerformance } from './regime';
import { computeRobustness, type RobustnessStats } from './robustness';
import { logWarn } from '@/lib/log';

export interface FullBacktestOutput {
  baseline: BacktestResult;
  monteCarlo: MonteCarloResult | null;
  walkForward: WalkForwardResult | null;
  stress: StressTestResult | null;
  regime: RegimePerformance[] | null;
  robustness: RobustnessStats | null;
  warnings: string[];
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
  const warnings: string[] = [];

  await onProgress?.({ phase: 'baseline', pct: 5 });
  // Baseline must succeed — otherwise there's nothing to report.
  const baseline = await runBacktest(bars, cfg);
  await onProgress?.({ phase: 'baseline', pct: 25 });

  let monteCarlo: MonteCarloResult | null = null;
  if ((cfg.monteCarloIterations ?? 0) > 0 && baseline.trades.length > 0) {
    try {
      monteCarlo = runMonteCarlo(baseline.trades, cfg.initialBalance, cfg.monteCarloIterations);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`monte_carlo: ${msg}`);
      logWarn('Backtest', 'Monte Carlo failed', { component: 'orchestrator', meta: { message: msg } });
    }
    await onProgress?.({ phase: 'monte_carlo', pct: 50 });
  }

  let walkForward: WalkForwardResult | null = null;
  if ((cfg.walkForwardWindows ?? 0) > 0) {
    try {
      walkForward = await runWalkForward(bars, cfg, cfg.walkForwardWindows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`walk_forward: ${msg}`);
      logWarn('Backtest', 'Walk-forward failed', { component: 'orchestrator', meta: { message: msg } });
    }
    await onProgress?.({ phase: 'walk_forward', pct: 75 });
  }

  let stress: StressTestResult | null = null;
  if (cfg.stressTests) {
    try {
      stress = await runStressTests(bars, cfg, baseline.metrics);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`stress: ${msg}`);
      logWarn('Backtest', 'Stress tests failed', { component: 'orchestrator', meta: { message: msg } });
    }
    await onProgress?.({ phase: 'stress', pct: 95 });
  }

  let regime: RegimePerformance[] | null = null;
  if (baseline.trades.length > 0 && bars.length >= 60) {
    try {
      const points = classifyRegimes(bars);
      regime = regimePerformance(points, baseline.trades);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`regime: ${msg}`);
      logWarn('Backtest', 'Regime classification failed', { component: 'orchestrator', meta: { message: msg } });
    }
  }

  let robustness: RobustnessStats | null = null;
  if (baseline.trades.length >= 10) {
    try {
      const numTrials = (cfg.walkForwardWindows ?? 0) > 0 ? (cfg.walkForwardWindows as number) : 1;
      robustness = computeRobustness(baseline.trades, numTrials);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`robustness: ${msg}`);
      logWarn('Backtest', 'Robustness stats failed', { component: 'orchestrator', meta: { message: msg } });
    }
  }

  await onProgress?.({ phase: 'done', pct: 100 });
  return { baseline, monteCarlo, walkForward, stress, regime, robustness, warnings };
}
