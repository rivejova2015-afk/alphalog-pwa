import type { Bar, BacktestConfig, BacktestResult } from '@/types/backtest';
import { runBacktest } from './engine';
import { runMonteCarlo, type MonteCarloResult } from './monte-carlo';
import { runWalkForward, type WalkForwardResult } from './walk-forward';
import { runStressTests, type StressTestResult } from './stress-tests';
import { classifyRegimes, regimePerformance, type RegimePerformance } from './regime';
import { computeRobustness, type RobustnessStats } from './robustness';
import { extractFeatures, buildLabels, trainModel, type MlModel } from './ml-signal';
import { logWarn } from '@/lib/log';

export interface MlAnalysis {
  used:      true;
  trainAcc:  number;
  validAcc:  number;
  featureNames: string[];
}

export interface AdvancedPipeline {
  ml:        MlAnalysis | null;
  multiTf:   { used: true; higherTimeframes: string[] } | null;
  portfolio: { used: true; pendingFetch: true; reason: string } | null;
}

export interface FullBacktestOutput {
  baseline: BacktestResult;
  monteCarlo: MonteCarloResult | null;
  walkForward: WalkForwardResult | null;
  stress: StressTestResult | null;
  regime: RegimePerformance[] | null;
  robustness: RobustnessStats | null;
  advanced: AdvancedPipeline | null;
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

  // Advanced opt-in pipeline (Plan v2 — Bloque C). Only runs when caller
  // sets the corresponding flag in cfg. Each block is independent and
  // failure of one does not block the others.
  let advanced: AdvancedPipeline | null = null;
  if (cfg.useMl || cfg.useMultiTf || cfg.usePortfolio) {
    advanced = { ml: null, multiTf: null, portfolio: null };

    if (cfg.useMl && bars.length >= 50) {
      try {
        const feats     = extractFeatures(bars);
        const labels    = buildLabels(bars, cfg.mlParams?.horizon ?? 10, cfg.mlParams?.threshold ?? 0.001);
        const trainable = Math.min(feats.length, labels.length);
        const features  = feats.slice(0, trainable);
        const ys        = labels.slice(0, trainable);
        // trainModel does its own train/valid split via opts.validationSplit (default 0.2)
        const model: MlModel = trainModel(features, ys, { validationSplit: 0.3 });
        advanced.ml = {
          used:         true,
          trainAcc:     model.trainAcc,
          validAcc:     model.validAcc,
          featureNames: model.featureNames,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`ml_signal: ${msg}`);
        logWarn('Backtest', 'ML signal failed', { component: 'orchestrator', meta: { message: msg } });
      }
    }

    if (cfg.useMultiTf) {
      // Multi-TF requires a SupabaseClient and is wired via run-job's data
      // layer, not from the pure orchestrator (which only sees `bars`).
      // Mark the intent so the worker / endpoint can hydrate downstream.
      advanced.multiTf = {
        used:             true,
        higherTimeframes: (cfg.multiTfParams?.higherTimeframes ?? ['H4', 'D1']) as string[],
      };
    }

    if (cfg.usePortfolio) {
      // Portfolio backtest is multi-symbol → also needs SupabaseClient.
      // Surface the intent to the worker so it can call runPortfolio()
      // with the proper data hooks.
      advanced.portfolio = {
        used:         true,
        pendingFetch: true,
        reason:       'runPortfolio requires Supabase client — wire in run-job.ts',
      };
    }
  }

  await onProgress?.({ phase: 'done', pct: 100 });
  return { baseline, monteCarlo, walkForward, stress, regime, robustness, advanced, warnings };
}
