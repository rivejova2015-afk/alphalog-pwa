#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

const SEVERITY_ORDER = {
  NONE: 0,
  S3: 1,
  S2: 2,
  S1: 3,
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [key, inline] = token.slice(2).split("=");
    if (inline !== undefined) {
      out[key] = inline;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoNow() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function profileFromName(name) {
  const normalized = normalizeName(name);
  if (normalized.includes("forex")) return "forex";
  if (normalized.includes("futuro")) return "futuros";
  return null;
}

function severityAtOrAbove(actual, threshold) {
  return SEVERITY_ORDER[actual] >= SEVERITY_ORDER[threshold];
}

function loadSloReport(reportPath) {
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, "utf8"));
  } catch {
    return null;
  }
}

function runSloMonitor({ baseUrl, marketPolicy, timezone }) {
  const tempPath = path.join(os.tmpdir(), `bot-slo-monitor-${Date.now()}.json`);
  const scriptPath = path.join(process.cwd(), "scripts", "bot-slo-monitor.js");
  const args = [
    scriptPath,
    "--baseUrl",
    baseUrl,
    "--output",
    tempPath,
    "--market-policy",
    marketPolicy,
    "--timezone",
    timezone,
  ];
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  const report = loadSloReport(tempPath);
  return {
    reportPath: tempPath,
    report,
    exitCode: result.status || 0,
  };
}

function shouldRecoverProfile(profileReport, actionOn) {
  if (!profileReport) return false;
  if (!severityAtOrAbove(profileReport.severity || "NONE", actionOn)) return false;
  const criticalCodes = new Set(["STALE_HEARTBEAT", "PENDING_TIMEOUT"]);
  const checks = Array.isArray(profileReport.checks) ? profileReport.checks : [];
  return checks.some((check) => criticalCodes.has(String(check.code || "")));
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env, ...loadEnvFile(path.join(process.cwd(), ".env.local")) };
  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const marketPolicy = String(args.marketPolicy || "auto").toLowerCase();
  const timezone = args.timezone || "America/Puerto_Rico";
  const actionOn = String(args.actionOn || "S1").toUpperCase();
  const cooldownMin = Math.max(1, asNumber(args.cooldownMin, 15));
  const dryRun = String(args.dryRun || "false").toLowerCase() === "true";
  const outputPath =
    args.output ||
    path.join(process.cwd(), "docs", "reports", `bot-auto-recovery-${Date.now()}.json`);

  if (!["AUTO", "FORCE-OPEN", "FORCE-CLOSED"].includes(marketPolicy.toUpperCase())) {
    throw new Error("Invalid marketPolicy. Use auto|force-open|force-closed");
  }
  if (!["S1", "S2"].includes(actionOn)) {
    throw new Error("Invalid actionOn. Use S1|S2");
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let sloReport = null;
  let sloReportPath = args.sloReport || null;
  if (sloReportPath) {
    sloReport = loadSloReport(sloReportPath);
  } else {
    const executed = runSloMonitor({ baseUrl, marketPolicy, timezone });
    sloReport = executed.report;
    sloReportPath = executed.reportPath;
  }

  if (!sloReport) {
    throw new Error("Unable to load SLO report for auto recovery");
  }

  const nowIso = isoNow();
  const report = {
    generatedAt: nowIso,
    baseUrl,
    marketPolicy,
    timezone,
    actionOn,
    cooldownMin,
    dryRun,
    sloReportPath,
    sloStatus: sloReport.status || "UNKNOWN",
    sloSeverity: sloReport.severity || "NONE",
    actions: [],
    skipped: [],
    errors: [],
    status: "NO_ACTION",
  };

  try {
    const [{ data: bots, error: botsError }, { data: botAccounts, error: accountsError }] = await Promise.all([
      supabase.from("bots").select("id,name,user_id"),
      supabase.from("bot_accounts").select("id,bot_id"),
    ]);
    if (botsError) throw botsError;
    if (accountsError) throw accountsError;

    const botsByProfile = {
      forex: [],
      futuros: [],
    };
    for (const bot of bots || []) {
      const profile = profileFromName(bot.name);
      if (!profile) continue;
      botsByProfile[profile].push(bot);
    }

    for (const profile of ["forex", "futuros"]) {
      const profileReport = sloReport.byProfile?.[profile];
      if (!shouldRecoverProfile(profileReport, actionOn)) {
        report.skipped.push({
          profile,
          reason: "below_threshold_or_no_critical_check",
          severity: profileReport?.severity || "NONE",
        });
        continue;
      }

      for (const bot of botsByProfile[profile]) {
        const cooldownIso = new Date(Date.now() - cooldownMin * 60 * 1000).toISOString();
        const recentRes = await supabase
          .from("bot_commands")
          .select("id,created_at,status")
          .eq("bot_id", bot.id)
          .eq("command_type", "RESTART_LOGIC")
          .gte("created_at", cooldownIso)
          .order("created_at", { ascending: false })
          .limit(1);
        if (recentRes.error) throw recentRes.error;

        if ((recentRes.data || []).length > 0) {
          report.skipped.push({
            profile,
            bot_id: bot.id,
            reason: "cooldown_active",
            recent_command_id: recentRes.data[0].id,
            recent_created_at: recentRes.data[0].created_at,
          });
          continue;
        }

        const accountIds = (botAccounts || [])
          .filter((account) => account.bot_id === bot.id)
          .map((account) => account.id);
        if (accountIds.length === 0) {
          report.skipped.push({
            profile,
            bot_id: bot.id,
            reason: "no_bot_accounts",
          });
          continue;
        }

        if (dryRun) {
          report.actions.push({
            profile,
            bot_id: bot.id,
            dryRun: true,
            command_type: "RESTART_LOGIC",
            accounts_count: accountIds.length,
          });
          continue;
        }

        const commandInsert = await supabase
          .from("bot_commands")
          .insert({
            bot_id: bot.id,
            command_type: "RESTART_LOGIC",
            payload: {
              source: "bot_auto_recovery",
              trigger_severity: profileReport.severity,
              trigger_codes: (profileReport.checks || []).map((check) => check.code),
              generated_at: nowIso,
            },
            target_scope: "all",
            status: "PENDING",
          })
          .select("id")
          .single();
        if (commandInsert.error) throw commandInsert.error;

        const commandId = commandInsert.data.id;
        const statusRows = accountIds.map((accountId) => ({
          command_id: commandId,
          bot_account_id: accountId,
          status: "PENDING",
        }));

        const statusInsert = await supabase.from("bot_command_status").insert(statusRows);
        if (statusInsert.error) throw statusInsert.error;

        const eventInsert = await supabase.from("bot_events").insert({
          bot_id: bot.id,
          event_type: "AUTO_RECOVERY_TRIGGERED",
          payload: {
            source: "bot_auto_recovery",
            profile,
            command_id: commandId,
            severity: profileReport.severity,
            generated_at: nowIso,
          },
        });
        if (eventInsert.error) throw eventInsert.error;

        report.actions.push({
          profile,
          bot_id: bot.id,
          command_id: commandId,
          command_type: "RESTART_LOGIC",
          accounts_count: accountIds.length,
          dryRun: false,
        });
      }
    }
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }

  if (report.errors.length > 0) {
    report.status = "ERROR";
  } else if (report.actions.some((action) => !action.dryRun)) {
    report.status = "RECOVERY_TRIGGERED";
  } else if (report.actions.length > 0 && report.actions.every((action) => action.dryRun)) {
    report.status = "DRY_RUN_MATCH";
  } else {
    report.status = "NO_ACTION";
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[bot-auto-recovery] report: ${outputPath}`);
  console.log(`[bot-auto-recovery] status: ${report.status}`);

  if (report.status === "ERROR") {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("[bot-auto-recovery] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});

