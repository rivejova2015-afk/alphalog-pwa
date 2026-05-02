import type { CheckContext, CheckFn, GateResult } from '../types';

const fail = (gate_key: string, reason: string): GateResult => ({
  gate_key, passed: false, value_observed: null, reason,
});

const numField = (obj: unknown, path: string[]): number | null => {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else return null;
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
};

export const sharpeOos: CheckFn = (ctx: CheckContext) => {
  const key = 'sharpe_oos';
  if (!ctx.backtest?.walk_forward) return fail(key, 'No walk-forward data en backtest');
  const v = numField(ctx.backtest.walk_forward, ['oos', 'sharpe'])
         ?? numField(ctx.backtest.walk_forward, ['oos_sharpe']);
  if (v === null) return fail(key, 'walk_forward.oos.sharpe ausente');
  return { gate_key: key, passed: v >= 1.5, value_observed: v, reason: v >= 1.5 ? null : `Sharpe OOS=${v.toFixed(2)} < 1.5` };
};

export const sampleSize: CheckFn = (ctx: CheckContext) => {
  const key = 'sample_size';
  if (!ctx.backtest) return fail(key, 'Sin backtest ejecutado');
  const v = numField(ctx.backtest.metrics, ['totalTrades'])
         ?? numField(ctx.backtest.metrics, ['total_trades']);
  if (v === null) return fail(key, 'metrics.totalTrades ausente');
  return { gate_key: key, passed: v >= 500, value_observed: v, reason: v >= 500 ? null : `Solo ${v} trades, requiere ≥500` };
};

export const walkForwardEff: CheckFn = (ctx: CheckContext) => {
  const key = 'walk_forward_eff';
  if (!ctx.backtest?.walk_forward) return fail(key, 'No walk-forward data');
  const v = numField(ctx.backtest.walk_forward, ['efficiency']);
  if (v === null) return fail(key, 'walk_forward.efficiency ausente');
  return { gate_key: key, passed: v >= 0.5, value_observed: v, reason: v >= 0.5 ? null : `Efficiency=${v.toFixed(2)} < 0.5` };
};

export const oosPct: CheckFn = (ctx: CheckContext) => {
  const key = 'oos_pct';
  if (!ctx.backtest?.walk_forward) return fail(key, 'No walk-forward data');
  const v = numField(ctx.backtest.walk_forward, ['oos_pct']);
  if (v === null) return fail(key, 'walk_forward.oos_pct ausente');
  return { gate_key: key, passed: v >= 30, value_observed: v, reason: v >= 30 ? null : `OOS=${v}% < 30%` };
};

export const profitFactor: CheckFn = (ctx: CheckContext) => {
  const key = 'profit_factor';
  if (!ctx.backtest) return fail(key, 'Sin backtest ejecutado');
  const v = numField(ctx.backtest.metrics, ['profitFactor'])
         ?? numField(ctx.backtest.metrics, ['profit_factor']);
  if (v === null) return fail(key, 'metrics.profitFactor ausente');
  return { gate_key: key, passed: v >= 1.4, value_observed: v, reason: v >= 1.4 ? null : `PF=${v.toFixed(2)} < 1.4` };
};

export const regimeConsistency: CheckFn = (ctx: CheckContext) => {
  const key = 'regime_consistency';
  if (!ctx.backtest?.stress_tests) return fail(key, 'Sin stress tests');
  const v = numField(ctx.backtest.stress_tests, ['regime_cv'])
         ?? numField(ctx.backtest.stress_tests, ['regimes', 'cv']);
  if (v === null) return fail(key, 'stress_tests.regime_cv ausente');
  return { gate_key: key, passed: v <= 0.3, value_observed: v, reason: v <= 0.3 ? null : `Regime CV=${v.toFixed(2)} > 0.3` };
};

export const edgeChecks: CheckFn[] = [
  sharpeOos, sampleSize, walkForwardEff, oosPct, profitFactor, regimeConsistency,
];
