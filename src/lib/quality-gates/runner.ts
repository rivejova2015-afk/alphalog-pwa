// Universal Tier-1 Quality Gates — main runner
//
// Carga el snapshot completo (algorithm + último backtest + telemetría + ops)
// y aplica las 20 funciones de check. Inserta los resultados en
// algorithm_quality_gate_results y devuelve el score.

import type { SupabaseClient } from '@supabase/supabase-js';
import { edgeChecks } from './checks/edge';
import { capitalChecks } from './checks/capital';
import { microChecks } from './checks/micro';
import { opsChecks } from './checks/ops';
import type {
  AlgorithmRow, BacktestSnapshot, CheckContext, GateResult,
  GateRow, GateScore, OpsSnapshot, TelemetrySnapshot,
} from './types';

const ALL_CHECKS = [...edgeChecks, ...capitalChecks, ...microChecks, ...opsChecks];

async function loadAlgorithm(sb: SupabaseClient, algorithmId: string, userId: string): Promise<AlgorithmRow> {
  const { data, error } = await sb
    .from('trading_algorithms')
    .select('id,user_id,name,status,parameters,deployments:algorithm_deployments(bot_account_id,status)')
    .eq('id', algorithmId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new Error(`Algorithm ${algorithmId} not found: ${error?.message ?? 'no row'}`);

  const params = (data.parameters as Record<string, unknown>) ?? {};
  const deps = (data.deployments as { bot_account_id: string | null; status: string }[] | null) ?? [];
  const activeDep = deps.find((d) => d.status === 'active') ?? deps[0] ?? null;

  const numParam = (key: string): number | null => {
    const v = params[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  return {
    id:                    data.id as string,
    user_id:               data.user_id as string,
    name:                  data.name as string,
    status:                data.status as string,
    risk_percent:          numParam('risk_percent'),
    max_drawdown_pct:      numParam('max_drawdown_pct'),
    linked_bot_account_id: activeDep?.bot_account_id ?? null,
    parameters:            params,
    scan_config:           (params.scan_config as Record<string, unknown> | null) ?? null,
  };
}

async function loadLatestBacktest(sb: SupabaseClient, algorithmId: string, userId: string): Promise<BacktestSnapshot | null> {
  const { data: jobs } = await sb
    .from('backtest_jobs')
    .select('id,config,created_at')
    .eq('algorithm_id', algorithmId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);
  if (!jobs?.length) return null;
  const job = jobs[0];
  const { data: res } = await sb
    .from('backtest_results')
    .select('metrics,walk_forward,stress_tests')
    .eq('job_id', job.id)
    .maybeSingle();
  if (!res) return null;
  return {
    job_id:       job.id,
    config:       (job.config as Record<string, unknown>) ?? {},
    metrics:      (res.metrics as Record<string, unknown>) ?? {},
    walk_forward: (res.walk_forward as Record<string, unknown> | null) ?? null,
    stress_tests: (res.stress_tests as Record<string, unknown> | null) ?? null,
    created_at:   job.created_at as string,
  };
}

async function loadTelemetry(sb: SupabaseClient, algo: AlgorithmRow): Promise<TelemetrySnapshot> {
  if (!algo.linked_bot_account_id) {
    return { last_heartbeat_ts: null, execution_latency_p99_ms: null };
  }
  const { data: latest } = await sb
    .from('bot_telemetry')
    .select('last_heartbeat_ts,payload')
    .eq('bot_account_id', algo.linked_bot_account_id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Computar p99 de execution_latency_ms desde últimos 200 telemetry rows
  const { data: recent } = await sb
    .from('bot_telemetry')
    .select('payload')
    .eq('bot_account_id', algo.linked_bot_account_id)
    .order('updated_at', { ascending: false })
    .limit(200);

  let p99: number | null = null;
  if (recent?.length) {
    const lats = recent
      .map((r) => {
        const p = r.payload as Record<string, unknown> | null;
        const v = p?.['execution_latency_ms'];
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      })
      .filter((x): x is number => x !== null)
      .sort((a, b) => a - b);
    if (lats.length >= 10) {
      const idx = Math.min(lats.length - 1, Math.floor(lats.length * 0.99));
      p99 = lats[idx];
    }
  }

  return {
    last_heartbeat_ts: (latest?.last_heartbeat_ts as string | null) ?? null,
    execution_latency_p99_ms: p99,
  };
}

async function loadOps(sb: SupabaseClient, algo: AlgorithmRow): Promise<OpsSnapshot> {
  // 1) Last KILL ack timing
  let lastKillAckMs: number | null = null;
  if (algo.linked_bot_account_id) {
    const { data: cmds } = await sb
      .from('bot_command_status')
      .select('command_id,acked_at,created_at,status')
      .eq('bot_account_id', algo.linked_bot_account_id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (cmds?.length) {
      // Buscar el último KILL command status
      const cmdIds = cmds.map((c) => c.command_id as string);
      const { data: killCmds } = await sb
        .from('bot_commands')
        .select('id,command_type,created_at')
        .in('id', cmdIds)
        .ilike('command_type', '%KILL%')
        .limit(5);
      if (killCmds?.length) {
        const killCmdIds = new Set(killCmds.map((k) => k.id as string));
        const killStatus = cmds.find((c) => killCmdIds.has(c.command_id as string) && c.acked_at);
        if (killStatus?.acked_at && killStatus.created_at) {
          lastKillAckMs = new Date(killStatus.acked_at as string).getTime() - new Date(killStatus.created_at as string).getTime();
        }
      }
    }
  }

  // 2) Forward paper trades últimos 30d
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count } = await sb
    .from('algo_paper_trades')
    .select('id', { count: 'exact', head: true })
    .eq('algorithm_id', algo.id)
    .gte('opened_at', since30d);

  // 3) Audit trail completo (heurística: parameters tienen flag explícito)
  const auditFlag = algo.parameters['audit_trail_enabled'];
  const auditOk = auditFlag === true;

  return {
    last_kill_ack_ms:     lastKillAckMs,
    paper_trades_30d:     count ?? 0,
    audit_trail_complete: auditOk,
  };
}

export async function buildContext(
  sb: SupabaseClient,
  algorithmId: string,
  userId: string,
): Promise<CheckContext> {
  const algo = await loadAlgorithm(sb, algorithmId, userId);
  const [backtest, telemetry, ops] = await Promise.all([
    loadLatestBacktest(sb, algorithmId, userId),
    loadTelemetry(sb, algo),
    loadOps(sb, algo),
  ]);
  return { algorithm: algo, backtest, telemetry, ops };
}

export function evaluateAll(ctx: CheckContext): GateResult[] {
  return ALL_CHECKS.map((fn) => fn(ctx));
}

export async function computeGates(
  sb: SupabaseClient,
  algorithmId: string,
  userId: string,
): Promise<{ score: GateScore; results: GateResult[] }> {
  const ctx = await buildContext(sb, algorithmId, userId);
  const results = evaluateAll(ctx);

  const rows: Omit<GateRow, 'id' | 'computed_at'>[] = results.map((r) => ({
    algorithm_id:   algorithmId,
    user_id:        userId,
    gate_key:       r.gate_key,
    passed:         r.passed,
    value_observed: r.value_observed,
    reason:         r.reason,
  }));

  const { error: insErr } = await sb.from('algorithm_quality_gate_results').insert(rows);
  if (insErr) throw new Error(`Insert quality gate results: ${insErr.message}`);

  const { data: scoreRow, error: scoreErr } = await sb
    .from('algorithm_quality_score')
    .select('*')
    .eq('algorithm_id', algorithmId)
    .maybeSingle();
  if (scoreErr) throw new Error(`Fetch score: ${scoreErr.message}`);

  const score: GateScore = scoreRow
    ? (scoreRow as GateScore)
    : {
        algorithm_id: algorithmId,
        gates_total: results.length,
        gates_passed: results.filter((r) => r.passed).length,
        must_failed: 0,
        should_failed: 0,
        last_computed_at: new Date().toISOString(),
        tier: 'NOT_READY',
      };

  return { score, results };
}
