import type { CheckContext, CheckFn, GateResult } from '../types';

const fail = (gate_key: string, reason: string): GateResult => ({
  gate_key, passed: false, value_observed: null, reason,
});

const cfgField = (cfg: Record<string, unknown> | undefined | null, key: string): unknown => {
  if (!cfg) return undefined;
  return cfg[key];
};

export const slippageRealistic: CheckFn = (ctx: CheckContext) => {
  const key = 'slippage_realistic';
  const model = cfgField(ctx.backtest?.config, 'slippage_model');
  const ok = model === 'liquidity_bucket' || model === 'spread_aware';
  return {
    gate_key: key,
    passed: ok,
    value_observed: ok ? 1 : 0,
    reason: ok ? null : `slippage_model="${String(model ?? 'none')}" — usar liquidity_bucket o spread_aware`,
  };
};

export const costsIncluded: CheckFn = (ctx: CheckContext) => {
  const key = 'costs_included';
  if (!ctx.backtest) return fail(key, 'Sin backtest config');
  const c = ctx.backtest.config;
  const hasSpread     = c['spread']     !== undefined || c['spread_pips']   !== undefined;
  const hasCommission = c['commission'] !== undefined || c['commission_per_lot'] !== undefined;
  const hasSwap       = c['swap']       !== undefined || c['swap_long']     !== undefined || c['include_swap'] === true;
  const allOk = hasSpread && hasCommission && hasSwap;
  const missing = [
    hasSpread ? null : 'spread',
    hasCommission ? null : 'commission',
    hasSwap ? null : 'swap',
  ].filter(Boolean);
  return {
    gate_key: key,
    passed: allOk,
    value_observed: allOk ? 1 : 0,
    reason: allOk ? null : `Falta modelar: ${missing.join(', ')}`,
  };
};

export const latencyP99: CheckFn = (ctx: CheckContext) => {
  const key = 'latency_p99';
  const v = ctx.telemetry.execution_latency_p99_ms;
  if (v === null) return fail(key, 'Sin telemetría de ejecución (correr el bot primero)');
  return { gate_key: key, passed: v <= 250, value_observed: v, reason: v <= 250 ? null : `p99=${v}ms > 250ms` };
};

export const survivorshipClean: CheckFn = (ctx: CheckContext) => {
  const key = 'survivorship_clean';
  const v = cfgField(ctx.backtest?.config, 'include_delisted');
  const ok = v === true;
  return {
    gate_key: key,
    passed: ok,
    value_observed: ok ? 1 : 0,
    reason: ok ? null : 'config.include_delisted no es true (riesgo survivorship bias)',
  };
};

export const microChecks: CheckFn[] = [
  slippageRealistic, costsIncluded, latencyP99, survivorshipClean,
];
