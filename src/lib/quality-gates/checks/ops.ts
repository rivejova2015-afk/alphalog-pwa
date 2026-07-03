import type { CheckContext, CheckFn } from '../types';

export const heartbeatActive: CheckFn = (ctx: CheckContext) => {
  const key = 'heartbeat_active';
  if (!ctx.telemetry.heartbeat_applicable) {
    return {
      gate_key: key, passed: true, applicable: false, value_observed: null,
      reason: 'No aplica — mercado sin telemetría de heartbeat wireada aún',
    };
  }
  const ts = ctx.telemetry.last_heartbeat_ts;
  if (!ts) return { gate_key: key, passed: false, value_observed: null, reason: 'Sin heartbeat — bot no conectado' };
  const ageSec = (Date.now() - new Date(ts).getTime()) / 1000;
  return {
    gate_key: key,
    passed: ageSec <= 120,
    value_observed: Math.round(ageSec),
    reason: ageSec <= 120 ? null : `Heartbeat hace ${Math.round(ageSec)}s (>120s)`,
  };
};

export const killSwitchWired: CheckFn = (ctx: CheckContext) => {
  const key = 'kill_switch_wired';
  const ms = ctx.ops.last_kill_ack_ms;
  if (ms === null) return { gate_key: key, passed: false, value_observed: null, reason: 'Sin KILL ack registrado — disparar test de kill-switch' };
  const ok = ms < 2000;
  return {
    gate_key: key,
    passed: ok,
    value_observed: ms,
    reason: ok ? null : `KILL ack=${ms}ms ≥ 2000ms`,
  };
};

export const auditTrail: CheckFn = (ctx: CheckContext) => {
  const key = 'audit_trail';
  const ok = ctx.ops.audit_trail_complete;
  return {
    gate_key: key,
    passed: ok,
    value_observed: ok ? 1 : 0,
    reason: ok ? null : 'Audit trail incompleto (faltan signal_payload o fill_payload)',
  };
};

export const versionPinned: CheckFn = (ctx: CheckContext) => {
  const key = 'version_pinned';
  const p = ctx.algorithm.parameters;
  const hasVersion = typeof p['engine_version'] === 'string' && (p['engine_version'] as string).length > 0;
  const hasSeed = typeof p['seed'] === 'number' || typeof p['seed'] === 'string';
  const ok = hasVersion && hasSeed;
  const missing = [
    hasVersion ? null : 'engine_version',
    hasSeed ? null : 'seed',
  ].filter(Boolean);
  return {
    gate_key: key,
    passed: ok,
    value_observed: ok ? 1 : 0,
    reason: ok ? null : `Faltan parameters: ${missing.join(', ')}`,
  };
};

export const forwardPaper30d: CheckFn = (ctx: CheckContext) => {
  const key = 'forward_paper_30d';
  const v = ctx.ops.paper_trades_30d;
  return {
    gate_key: key,
    passed: v >= 100,
    value_observed: v,
    reason: v >= 100 ? null : `Solo ${v} paper trades en últimos 30d (requiere ≥100)`,
  };
};

export const opsChecks: CheckFn[] = [
  heartbeatActive, killSwitchWired, auditTrail, versionPinned, forwardPaper30d,
];
