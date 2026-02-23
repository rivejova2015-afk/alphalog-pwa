#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { cleanupTempSecrets } = require("./security/cleanup-temp-secrets");

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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const [k, inline] = token.slice(2).split("=");
    if (inline !== undefined) {
      out[k] = inline;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[k] = "true";
      continue;
    }
    out[k] = next;
    i += 1;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maybeKillPid(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

async function safeDelete(table, filter, supabase) {
  let query = supabase.from(table).delete();
  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }
  const { error } = await query;
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
}

async function countRows(table, filter, supabase) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`${table} count: ${error.message}`);
  }
  return count || 0;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

function hasCleanupResiduals(cleanup) {
  const values = Object.values(cleanup?.residuals || {});
  return values.some((count) => Number(count) > 0);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const reportPath = args.reportPath;
  const contextPath = args.contextPath;
  const outputPath = args.outputPath || path.join(process.cwd(), `pilot-runtime-final-${Date.now()}.json`);
  const pollSec = Number(args.pollSec || 60);
  const timeoutMin = Number(args.timeoutMin || 1500);
  const emulatorPid = Number(args.emulatorPid || 0);
  const archiveDir = args.archiveDir || path.join(process.cwd(), "docs", "reports");

  if (!reportPath || !contextPath) {
    throw new Error("Missing --reportPath or --contextPath");
  }

  const startedAt = new Date().toISOString();
  console.log(`[finalizer] started ${startedAt}`);
  console.log(`[finalizer] waiting report: ${reportPath}`);

  const timeoutAt = Date.now() + timeoutMin * 60 * 1000;
  while (Date.now() < timeoutAt) {
    if (fs.existsSync(reportPath)) break;
    await sleep(pollSec * 1000);
  }

  if (!fs.existsSync(reportPath)) {
    throw new Error("Timed out waiting pilot report file");
  }

  const pilotReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const context = JSON.parse(fs.readFileSync(contextPath, "utf8"));
  const env = { ...process.env, ...loadEnvFile(path.join(process.cwd(), ".env.local")) };

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const diagnostic = {};
  const commandStatus = await supabase
    .from("bot_command_status")
    .select("status, created_at, updated_at")
    .eq("bot_account_id", context.bot_account_id);
  if (commandStatus.error) throw commandStatus.error;

  const statusRows = commandStatus.data || [];
  diagnostic.commandStatusCounts = statusRows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  const instance = await supabase
    .from("bot_instances")
    .select("instance_id,last_heartbeat_at,status,updated_at")
    .eq("id", context.bot_instance_id)
    .maybeSingle();
  if (instance.error) throw instance.error;
  diagnostic.instance = instance.data || null;

  const telemetry = await supabase
    .from("bot_telemetry")
    .select("last_heartbeat_ts,equity,balance,updated_at")
    .eq("bot_account_id", context.bot_account_id)
    .maybeSingle();
  if (telemetry.error) throw telemetry.error;
  diagnostic.telemetry = telemetry.data || null;

  const symbol = `AUTO_${context.tag}`;
  const market = await supabase
    .from("live_market_data")
    .select("symbol,updated_at,last")
    .eq("symbol", symbol)
    .maybeSingle();
  if (market.error) throw market.error;
  diagnostic.marketData = market.data || null;

  const cleanup = { attempted: true, errors: [], residuals: {} };
  try {
    await safeDelete("bot_command_status", { bot_account_id: context.bot_account_id }, supabase);
    await safeDelete("bot_commands", { bot_id: context.bot_id }, supabase);
    await safeDelete("bot_telemetry", { bot_account_id: context.bot_account_id }, supabase);
    await safeDelete("bot_instances", { id: context.bot_instance_id }, supabase);
    await safeDelete("bot_settings_global", { bot_id: context.bot_id }, supabase);
    await safeDelete("bot_accounts", { id: context.bot_account_id }, supabase);
    await safeDelete("bots", { id: context.bot_id }, supabase);
    await safeDelete("accounts", { id: context.app_account_id }, supabase);
    await safeDelete("account_categories", { id: context.category_id }, supabase);
    await safeDelete("live_market_data", { symbol }, supabase);

    cleanup.residuals.bot_command_status = await countRows("bot_command_status", { bot_account_id: context.bot_account_id }, supabase);
    cleanup.residuals.bot_commands = await countRows("bot_commands", { bot_id: context.bot_id }, supabase);
    cleanup.residuals.bot_telemetry = await countRows("bot_telemetry", { bot_account_id: context.bot_account_id }, supabase);
    cleanup.residuals.bot_instances = await countRows("bot_instances", { id: context.bot_instance_id }, supabase);
    cleanup.residuals.bot_accounts = await countRows("bot_accounts", { id: context.bot_account_id }, supabase);
    cleanup.residuals.bots = await countRows("bots", { id: context.bot_id }, supabase);
    cleanup.residuals.accounts = await countRows("accounts", { id: context.app_account_id }, supabase);
    cleanup.residuals.account_categories = await countRows("account_categories", { id: context.category_id }, supabase);
    cleanup.residuals.live_market_data = await countRows("live_market_data", { symbol }, supabase);
  } catch (error) {
    cleanup.errors.push(error instanceof Error ? error.message : String(error));
  }

  const emulatorStopped = maybeKillPid(emulatorPid);
  const secretsCleanup = cleanupTempSecrets({ dryRun: false, logger: console });
  const cleanupResidualsPresent = hasCleanupResiduals(cleanup);
  const cleanupPassed = cleanup.errors.length === 0 && !cleanupResidualsPresent;

  const finalReport = {
    generatedAt: new Date().toISOString(),
    pilotSummary: pilotReport.summary || null,
    pilotStartedAt: pilotReport.startedAt || null,
    pilotEndedAt: pilotReport.endedAt || null,
    diagnostic,
    cleanup,
    secretsCleanup,
    emulator: {
      pid: emulatorPid || null,
      stopped: emulatorStopped,
    },
    status:
      (pilotReport.summary?.status === "PASS" && cleanupPassed)
        ? "PASS"
        : "CHECK_REQUIRED",
  };

  fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 2), "utf8");

  ensureDir(archiveDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseTag = String(context.tag || "pilot").replace(/[^a-zA-Z0-9_-]/g, "_");
  const archivedPilot = path.join(archiveDir, `bot-runtime-pilot-${baseTag}-${stamp}.json`);
  const archivedFinal = path.join(archiveDir, `bot-runtime-final-${baseTag}-${stamp}.json`);
  const archiveResult = {
    pilotCopied: copyIfExists(reportPath, archivedPilot),
    finalCopied: copyIfExists(outputPath, archivedFinal),
    archivedPilot,
    archivedFinal,
  };
  finalReport.archive = archiveResult;
  fs.writeFileSync(outputPath, JSON.stringify(finalReport, null, 2), "utf8");

  console.log(`[finalizer] wrote ${outputPath}`);
  console.log(`[finalizer] archived pilot=${archiveResult.pilotCopied} final=${archiveResult.finalCopied}`);
  console.log(`[finalizer] status ${finalReport.status}`);
}

run().catch((error) => {
  console.error("[finalizer] fatal", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
