import type { CheckContext, CheckFn, GateResult } from '../types';

const fail = (gate_key: string, reason: string): GateResult => ({
  gate_key, passed: false, value_observed: null, reason,
});

const numParam = (params: Record<string, unknown>, key: string): number | null => {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

export const riskPerTrade: CheckFn = (ctx: CheckContext) => {
  const key = 'risk_per_trade';
  const v = ctx.algorithm.risk_percent ?? numParam(ctx.algorithm.parameters, 'risk_percent');
  if (v === null) return fail(key, 'risk_percent no configurado');
  return { gate_key: key, passed: v <= 1.0, value_observed: v, reason: v <= 1.0 ? null : `risk=${v}% > 1%` };
};

export const kellyFraction: CheckFn = (ctx: CheckContext) => {
  const key = 'kelly_fraction';
  // Buscar primero en backtest metrics, fallback a parameters
  let v: number | null = null;
  if (ctx.backtest?.metrics && typeof ctx.backtest.metrics === 'object') {
    const m = ctx.backtest.metrics as Record<string, unknown>;
    if (typeof m.kelly_fraction === 'number') v = m.kelly_fraction;
  }
  if (v === null) v = numParam(ctx.algorithm.parameters, 'kelly_fraction');
  if (v === null) return fail(key, 'kelly_fraction ausente (config o backtest)');
  return { gate_key: key, passed: v <= 0.25, value_observed: v, reason: v <= 0.25 ? null : `Kelly=${v.toFixed(3)} > 0.25 (¼ Kelly)` };
};

export const maxDrawdown: CheckFn = (ctx: CheckContext) => {
  const key = 'max_drawdown';
  let v: number | null = null;
  if (ctx.backtest?.metrics) {
    const m = ctx.backtest.metrics as Record<string, unknown>;
    const cand = m.maxDrawdown ?? m.max_drawdown;
    if (typeof cand === 'number' && Number.isFinite(cand)) v = cand;
  }
  if (v === null) v = ctx.algorithm.max_drawdown_pct;
  if (v === null) return fail(key, 'max_drawdown ausente');
  // Acepta tanto fracción (0.18) como porcentaje (18)
  const pct = v <= 1 ? v * 100 : v;
  return { gate_key: key, passed: pct < 20, value_observed: pct, reason: pct < 20 ? null : `DD=${pct.toFixed(1)}% ≥ 20%` };
};

export const correlationCap: CheckFn = (ctx: CheckContext) => {
  const key = 'correlation_cap';
  const v = numParam(ctx.algorithm.parameters, 'max_correlation');
  if (v === null) return fail(key, 'parameters.max_correlation ausente');
  return { gate_key: key, passed: v <= 0.7, value_observed: v, reason: v <= 0.7 ? null : `max_corr=${v.toFixed(2)} > 0.7` };
};

export const ddLimitsSet: CheckFn = (ctx: CheckContext) => {
  const key = 'dd_limits_set';
  const v = ctx.algorithm.parameters['daily_dd_limit'];
  const has = typeof v === 'number' && Number.isFinite(v) && v > 0;
  return { gate_key: key, passed: has, value_observed: has ? 1 : 0, reason: has ? null : 'parameters.daily_dd_limit no definido (kill-switch diario obligatorio)' };
};

export const capitalChecks: CheckFn[] = [
  riskPerTrade, kellyFraction, maxDrawdown, correlationCap, ddLimitsSet,
];
