#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const REQUIRED_TABLES = [
  "account_categories",
  "accounts",
  "setups",
  "trades",
  "categories",
  "tags",
  "logs",
  "terminal_news",
  "terminal_events",
  "terminal_evidence_reports",
  "terminal_evidence_attachments",
  "copy_groups",
  "copy_group_nodes",
  "copy_group_links",
  "copy_group_versions",
  "copy_group_snapshots",
  "copy_group_events",
  "trade_replication_map",
  "slave_trade_links",
  "copy_group_experiments",
  "replication_jobs",
  "bot_accounts",
  "bot_instances",
  "bot_commands",
  "bot_command_status",
  "bot_telemetry",
  // Migrations 047-053
  "bot_signal_engine_state",
  "bot_regime_states",
  "bot_skills",
  "bot_skill_audit_log",
  "bot_active_skill",
  "iv_surface_snapshots",
  "paper_trades",
  // Migrations 057-060 (pairing, algorithms, backtest, open positions)
  "bot_open_positions",
  "trading_algorithms",
  "algorithm_deployments",
  "algorithm_backtest_results",
  // Migration 046 adds columns to bot_instances — already covered above
];

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
  const failing = rows.filter((row) => row.status !== "ok");

  console.log("[security:check-rls] coverage summary");
  rows.forEach((row) => {
    console.log(
      `${String(row.table_name).padEnd(32)} status=${row.status} rls=${row.rls_enabled} policies=${row.policy_count}`
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
