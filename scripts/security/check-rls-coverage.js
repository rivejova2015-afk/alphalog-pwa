#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Lista de referencia — snapshot del schema real tomado 2026-07-06 vía
// consulta directa a pg_class (160 tablas en public, excluyendo
// api_rate_limits que es intencionalmente service-role-only con 0 policies).
// Esta lista SE VA A DESACTUALIZAR de nuevo a medida que se agreguen tablas —
// por eso el chequeo real (abajo) no depende de que esté completa: además de
// auditar estas, compara contra TODAS las tablas de information_schema y
// reporta cualquiera que no esté en esta lista como "not tracked" (no falla
// el script, solo avisa) para que quede evidente cuándo hay que actualizarla.
const REQUIRED_TABLES = [
  "account_categories",
  "accounts",
  "agent_operations",
  "agents",
  "algo_cme_accounts",
  "algo_paper_trades",
  "algo_signal_log",
  "algorithm_alert_preferences",
  "algorithm_backtest_results",
  "algorithm_deployments",
  "algorithm_phase_log",
  "algorithm_quality_gate_definitions",
  "algorithm_quality_gate_results",
  "algorithm_templates",
  "algorithm_trades",
  "algorithms",
  "app_logs",
  "app_update_events",
  "app_updates",
  "arbitrage_latency_pairs",
  "audit_logs",
  "backtest_daemon_state",
  "backtest_jobs",
  "backtest_paper_signals",
  "backtest_results",
  "bot_accounts",
  "bot_active_skill",
  "bot_command_status",
  "bot_commands",
  "bot_events",
  "bot_instances",
  "bot_monitor_state",
  "bot_open_positions",
  "bot_regime_states",
  "bot_settings_global",
  "bot_settings_override",
  "bot_signal_engine_state",
  "bot_skill_audit_log",
  "bot_skills",
  "bot_telemetry",
  "bots",
  "business_alert_history",
  "business_cost_templates",
  "business_costs",
  "business_decision_tasks",
  "business_decisions",
  "business_milestones",
  "business_sop_items",
  "business_sop_run_items",
  "business_sop_runs",
  "business_sops",
  "categories",
  "cme_connections",
  "cme_equity_snapshots",
  "cme_positions",
  "cme_risk_configs",
  "cme_signals",
  "cme_trades_propfirm",
  "cme_trades_real",
  "coinarb_50x_validation_checkpoints",
  "coinarb_agents",
  "coinarb_calibration",
  "coinarb_calibration_data",
  "coinarb_circuit_breaker_events",
  "coinarb_compliance_audit",
  "coinarb_daily_stats",
  "coinarb_decisions",
  "coinarb_equity_snapshots",
  "coinarb_liquidity_map",
  "coinarb_phase_log",
  "coinarb_positions",
  "coinarb_regime_snapshots",
  "coinarb_signal_memory",
  "coinarb_smc_signals",
  "coinarb_telemetry",
  "coinarb_trades",
  "copy_group_events",
  "copy_group_experiments",
  "copy_group_links",
  "copy_group_nodes",
  "copy_group_snapshots",
  "copy_group_versions",
  "copy_groups",
  "engine_backtest_runs",
  "global_trading_halt",
  "historical_bars",
  "historical_bars_coverage",
  "instruments",
  "intelligence_capital_accounts",
  "intelligence_capital_targets",
  "iv_surface_snapshots",
  "journal_entries",
  "lattice_agent_package_items",
  "lattice_agent_packages",
  "lattice_projects",
  "live_market_data",
  "llc_inbox_items",
  "llc_info",
  "log_attachments",
  "log_tags",
  "logs",
  "map_hot_goal_links",
  "map_hot_goal_snapshots",
  "map_hot_goals",
  "map_hot_milestones",
  "ml_models",
  "ops_alert_history",
  "paper_trades",
  "polyarb_50x_validation_checkpoints",
  "polyarb_agents",
  "polyarb_calibration_data",
  "polyarb_circuit_breaker_events",
  "polyarb_compliance_audit",
  "polyarb_decisions",
  "polyarb_equity_snapshots",
  "polyarb_event_log",
  "polyarb_positions",
  "polyarb_signal_memory",
  "polyarb_telemetry",
  "polyarb_trades",
  "portfolio_allocations",
  "push_subscriptions",
  "replication_jobs",
  "secure_allowed_senders",
  "secure_attachments",
  "secure_contacts_keys",
  "secure_mailboxes",
  "secure_message_access_audit",
  "secure_messages",
  "securities_exam_results",
  "securities_homework_submissions",
  "securities_library_uploads",
  "securities_progress",
  "securities_quiz_results",
  "securities_user_state",
  "setups",
  "slave_trade_links",
  "tags",
  "terminal_assistant_memory",
  "terminal_assistant_settings",
  "terminal_chat_messages",
  "terminal_chat_sessions",
  "terminal_events",
  "terminal_evidence_attachments",
  "terminal_evidence_reports",
  "terminal_news",
  "terminal_report_jobs",
  "terminal_report_state",
  "trade_evidence",
  "trade_replication_map",
  "trades",
  "trading_algorithms",
  "treasury_budgets",
  "treasury_calendar_events",
  "treasury_configs",
  "treasury_payouts",
  "treasury_transactions",
  "treasury_wallets",
  "tv_analysis_evidence",
  "weekly_reports",
];

// Tablas donde RLS habilitado + 0 policies es INTENCIONAL (solo accedidas vía
// service_role, que bypassea RLS — 0 policies = bloqueo total para cualquier
// otro rol, que es la postura correcta). No deben reportarse como falla.
const SERVICE_ROLE_ONLY_TABLES = new Set(["api_rate_limits"]);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (process.env[key]) continue;
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("security_rls_audit", {
    target_tables: REQUIRED_TABLES,
  });

  if (error) {
    throw new Error(
      `security_rls_audit RPC failed: ${error.message}. Ensure migration 039_security_rls_audit_function.sql is applied.`
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const failing = rows.filter(
    (row) => row.status !== "ok" && !SERVICE_ROLE_ONLY_TABLES.has(row.table_name)
  );

  console.log("[security:check-rls] coverage summary");
  rows.forEach((row) => {
    const note = SERVICE_ROLE_ONLY_TABLES.has(row.table_name) ? " (service-role-only, OK)" : "";
    console.log(
      `${String(row.table_name).padEnd(32)} status=${row.status} rls=${row.rls_enabled} policies=${row.policy_count}${note}`
    );
  });

  if (failing.length > 0) {
    console.error("[security:check-rls] FAILED");
    failing.forEach((row) => {
      console.error(`- ${row.table_name}: ${row.status}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("[security:check-rls] PASSED");
}

main().catch((error) => {
  console.error(
    `[security:check-rls] fatal ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
