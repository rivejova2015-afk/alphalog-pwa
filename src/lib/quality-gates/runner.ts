// Universal Tier-1 Quality Gates — main runner
//
// Carga el snapshot completo (algorithm + último backtest + telemetría + ops)
// y aplica las 20 funciones de check. Inserta los resultados en
// algorithm_quality_gate_results y devuelve el score.
//
// Deploy-time gate: triggered by POST /promote-to-live and
// /quality-gates/recompute, DB-persisted (algorithm_quality_gate_results +
// algorithm_quality_gate_definitions + algorithm_quality_score view). This is
// ONE of three independent "quality gate" systems in this repo (Wave 3 item
// 9 audit, 2026-07) — the other two are src/lib/engine/v1/quality-gates.ts
// (ephemeral in-memory draft→paper gates for the Engine v1 simulator) and
// coinarb/scripts/check-backtest-threshold.ts (manual/local regression
// script for the coinarb sub-project, not CI-wired). None of the three call
// or read from each other — that's intentional, not an oversight, since
// each gates a genuinely different lifecycle. Do not merge without reading
// all three first; they were audited together and found to serve distinct
// purposes despite the similar name.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getPgClient } from '@/lib/pg/client';
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
  // algorithms is in-scope (own Postgres); the shim has no embedded/joined
  // selects, so the original `deployments:algorithm_deployments(...)` embed
  // is split into a second lookup against `algorithm_deployments` directly
  // by `algorithm_id` (algorithm_deployments is not one of the 16 migrated
  // tables and stays on the injected `sb`/Supabase).
  const pg = getPgClient();
  const { data, error } = await pg
    .from('algorithms')
    .select('id,user_id,name,status,market_type,parameters,risk_percent,max_drawdown_pct,linked_bot_account_id,scan_config,deployments:algorithm_deployments(bot_account_id,status)')
    .eq('id', algorithmId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (error || !data) throw new Error(`Algorithm ${algorithmId} not found: ${error?.message ?? 'no row'}`);

  const row = data as unknown as {
    id: string; user_id: string; name: string; status: string;
    parameters: Record<string, unknown> | null; risk_percent: number | string | null;
    max_drawdown_pct: number | string | null; linked_bot_account_id: string | null;
    scan_config: Record<string, unknown> | null;
  };

  const { data: deploymentsData } = await sb
    .from('algorithm_deployments')
    .select('bot_account_id,status')
    .eq('algorithm_id', algorithmId);

  const params = (row.parameters as Record<string, unknown>) ?? {};
  const deps = (deploymentsData as { bot_account_id: string | null; status: string }[] | null) ?? [];
  const activeDep = deps.find((d) => d.status === 'active') ?? deps[0] ?? null;

  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  return {
    id:                    data.id as string,
    user_id:               data.user_id as string,
    name:                  data.name as string,
    status:                data.status as string,
    market_type:           (data.market_type as string | null) ?? 'forex',
    risk_percent:          num(data.risk_percent),
    max_drawdown_pct:      num(data.max_drawdown_pct),
    linked_bot_account_id: (data.linked_bot_account_id as string | null) ?? activeDep?.bot_account_id ?? null,
    parameters:            params,
    scan_config:           row.scan_config ?? null,
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
  // Crypto (coinarb) escribe a coinarb_telemetry, no a bot_telemetry — no
  // está atado a linked_bot_account_id sino al user_id del owner del bot.
  // No trackea execution_latency_ms hoy, así que ese gate queda N/A.
  if (algo.market_type === 'crypto') {
    const { data: latest } = await sb
      .from('coinarb_telemetry')
      .select('last_heartbeat_at')
      .eq('user_id', algo.user_id)
      .order('last_heartbeat_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      last_heartbeat_ts: (latest?.last_heartbeat_at as string | null) ?? null,
      execution_latency_p99_ms: null,
      heartbeat_applicable: true,
      latency_applicable: false,
    };
  }

  // CME (futures) no tiene una fuente de heartbeat/latencia wireada todavía
  // (ver auditoría 2026-07) — ambos gates quedan N/A hasta que se implemente.
  if (algo.market_type === 'futures') {
    return {
      last_heartbeat_ts: null,
      execution_latency_p99_ms: null,
      heartbeat_applicable: false,
      latency_applicable: false,
    };
  }

  // forex (MT5) — comportamiento original, vía bot_telemetry.
  if (!algo.linked_bot_account_id) {
    return {
      last_heartbeat_ts: null,
      execution_latency_p99_ms: null,
      heartbeat_applicable: true,
      latency_applicable: true,
    };
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
    heartbeat_applicable: true,
    latency_applicable: true,
  };
}

async function loadOps(sb: SupabaseClient, algo: AlgorithmRow): Promise<OpsSnapshot> {
  void sb;
  const pg = getPgClient();

  // 1) Last KILL ack timing.
  // bot_command_status + bot_commands are in-scope (own Postgres); the shim
  // has no `.limit()` on bot_command_status, and no `.in()` / `.ilike()` /
  // `.limit()` on bot_commands. bot_command_status: fetch ordered rows
  // (order preserved from the shim's SQL ORDER BY) and slice(0,20) in JS.
  // bot_commands: cmdIds is already bounded to ≤20 ids from that slice, so
  // look each one up individually (bounded fan-out) instead of `.in()`, then
  // apply the case-insensitive "KILL" substring match and slice(0,5) in JS.
  let lastKillAckMs: number | null = null;
  if (algo.linked_bot_account_id) {
    const { data: cmdsRaw } = await pg
      .from('bot_command_status')
      .select('command_id,acked_at,created_at,status')
      .eq('bot_account_id', algo.linked_bot_account_id)
      .order('created_at', { ascending: false });
    const cmds = ((cmdsRaw ?? []) as unknown as {
      command_id: string; acked_at: string | Date | null; created_at: string | Date; status: string;
    }[]).slice(0, 20);

    if (cmds.length) {
      // Buscar el último KILL command status
      const cmdIds = cmds.map((c) => c.command_id);
      const killCmdLookups = await Promise.all(
        cmdIds.map((id) => pg.from('bot_commands').select('id,command_type,created_at').eq('id', id).single()),
      );
      const killCmds = killCmdLookups
        .map((r) => r.data as unknown as { id: string; command_type: string; created_at: string | Date } | null)
        .filter((c): c is { id: string; command_type: string; created_at: string | Date } =>
          c !== null && typeof c.command_type === 'string' && c.command_type.toUpperCase().includes('KILL'))
        .slice(0, 5);

      if (killCmds.length) {
        const killCmdIds = new Set(killCmds.map((k) => k.id));
        const killStatus = cmds.find((c) => killCmdIds.has(c.command_id) && c.acked_at);
        if (killStatus?.acked_at && killStatus.created_at) {
          lastKillAckMs = new Date(killStatus.acked_at).getTime() - new Date(killStatus.created_at).getTime();
        }
      }
    }
  }

  // 2) Forward paper trades últimos 30d.
  // algo_paper_trades is in-scope; the shim has no `.gte()` /
  // count-with-`{count:'exact',head:true}`. Fetch the algorithm's rows and
  // count how many have opened_at >= since30d in JS. Both sides of the date
  // comparison go through `new Date(...).getTime()` — the pg driver
  // auto-parses `opened_at` (timestamptz) into a Date at runtime, and a bare
  // `Date >= string` comparison silently always evaluates false.
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const since30dMs = new Date(since30d).getTime();
  const { data: paperTradesRaw } = await pg
    .from('algo_paper_trades')
    .select('id, opened_at')
    .eq('algorithm_id', algo.id);
  const paperTrades30d = ((paperTradesRaw ?? []) as unknown as { id: string; opened_at: string | Date | null }[])
    .filter((t) => t.opened_at !== null && new Date(t.opened_at).getTime() >= since30dMs)
    .length;

  // 3) Audit trail completo (heurística: parameters tienen flag explícito)
  const auditFlag = algo.parameters['audit_trail_enabled'];
  const auditOk = auditFlag === true;

  return {
    last_kill_ack_ms:     lastKillAckMs,
    paper_trades_30d:     paperTrades30d,
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

  // Gates marcados applicable:false (ej: heartbeat/latency en mercados sin
  // esa telemetría wireada) no se insertan — así no cuentan en gates_total
  // ni pueden bloquear TIER_1 (ver migration 133). `results` completo
  // (incluyendo no-aplicables) se devuelve igual para que la UI pueda
  // mostrarlos como "N/A" en vez de simplemente omitirlos.
  const applicableResults = results.filter((r) => r.applicable !== false);

  const rows: Omit<GateRow, 'id' | 'computed_at'>[] = applicableResults.map((r) => ({
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
        gates_total: applicableResults.length,
        gates_passed: applicableResults.filter((r) => r.passed).length,
        must_failed: 0,
        should_failed: 0,
        last_computed_at: new Date().toISOString(),
        tier: 'NOT_READY',
      };

  return { score, results };
}
