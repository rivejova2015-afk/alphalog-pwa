#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
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

function resolveProfile(name) {
  const value = normalizeName(name);
  if (value.includes("futuro")) return "futuros";
  if (value.includes("forex")) return "forex";
  return null;
}

function getWorstSeverity(current, next) {
  return SEVERITY_ORDER[next] > SEVERITY_ORDER[current] ? next : current;
}

function severityToStatus(severity) {
  if (severity === "S1") return "FAIL";
  if (severity === "S2" || severity === "S3") return "DEGRADED";
  return "PASS";
}

function getZonedClock(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return { weekday, hour, minute };
}

function weekdayToIndex(weekday) {
  const map = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? -1;
}

function isForexOpen(clock) {
  const day = weekdayToIndex(clock.weekday);
  if (day === 0) return clock.hour >= 17;
  if (day >= 1 && day <= 4) return true;
  if (day === 5) return clock.hour < 17;
  return false;
}

function isFuturesOpen(clock) {
  const day = weekdayToIndex(clock.weekday);
  if (day === 0) return clock.hour >= 18;
  if (day >= 1 && day <= 4) return true;
  if (day === 5) return clock.hour < 17;
  return false;
}

function getMarketState({ policy, clock }) {
  if (policy === "force-open") {
    return {
      forex: { open: true, reason: "forced_open" },
      futuros: { open: true, reason: "forced_open" },
    };
  }
  if (policy === "force-closed") {
    return {
      forex: { open: false, reason: "forced_closed" },
      futuros: { open: false, reason: "forced_closed" },
    };
  }
  return {
    forex: { open: isForexOpen(clock), reason: "auto_schedule" },
    futuros: { open: isFuturesOpen(clock), reason: "auto_schedule" },
  };
}

function summarizeRecommendations(checks) {
  const recommendations = [];
  if (checks.some((check) => check.code === "NO_ACTIVE_INSTANCES")) {
    recommendations.push("Confirmar MT5 terminal/EA en linea y estado ACTIVE en bot_instances.");
  }
  if (checks.some((check) => check.code === "STALE_HEARTBEAT")) {
    recommendations.push("Verificar flujo bot-telemetry y sincronizacion de instance_secret.");
  }
  if (checks.some((check) => check.code === "PENDING_TIMEOUT")) {
    recommendations.push("Revisar polling de bot-commands y ACK path en bot-ack.");
  }
  if (checks.some((check) => check.code === "ACK_LATENCY")) {
    recommendations.push("Ajustar throttling del EA para mantener ACK por debajo del umbral.");
  }
  if (checks.some((check) => check.code === "FAILED_RATIO")) {
    recommendations.push("Auditar comandos fallidos recientes y corregir causa raiz antes de reintentos.");
  }
  return recommendations;
}

async function dispatchAlert({ baseUrl, token, report }) {
  if (!token) {
    return {
      sent: false,
      reason: "OPS_ALERT_TOKEN missing",
    };
  }

  const payload = {
    status: report.status,
    severity: report.severity,
    generatedAt: report.generatedAt,
    windowMin: report.config.windowMin,
    byProfile: report.byProfile,
    checks: report.checks,
    recommendedActions: report.recommendedActions,
  };

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/ops/bot-slo-alert`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ops-token": token,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => ({}));
    return {
      sent: response.ok,
      status: response.status,
      body: responseBody,
    };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildProfileAssessment({
  profile,
  botIds,
  botAccounts,
  botInstances,
  commandStatus,
  thresholds,
  marketState,
  nowMs,
  windowStartMs,
}) {
  const accountIds = botAccounts
    .filter((account) => botIds.has(account.bot_id))
    .map((account) => account.id);
  const accountSet = new Set(accountIds);

  const instances = botInstances.filter((instance) => accountSet.has(instance.bot_account_id));
  const activeInstances = instances.filter((instance) => {
    const status = String(instance.status || "").toLowerCase();
    return status !== "offline";
  });

  const profileCommandStatus = commandStatus.filter((status) => accountSet.has(status.bot_account_id));
  const stalePending = profileCommandStatus.filter((status) => {
    const createdAtMs = new Date(status.created_at || "").getTime();
    return (
      status.status === "PENDING" &&
      Number.isFinite(createdAtMs) &&
      createdAtMs < nowMs - thresholds.pendingThresholdSec * 1000
    );
  });
  const ackInWindow = profileCommandStatus.filter((status) => {
    if (!status.acked_at) return false;
    const ackedAtMs = new Date(status.acked_at).getTime();
    return Number.isFinite(ackedAtMs) && ackedAtMs >= windowStartMs;
  });
  const ackBreaches = ackInWindow.filter((status) => {
    const createdAtMs = new Date(status.created_at || "").getTime();
    const ackedAtMs = new Date(status.acked_at || "").getTime();
    if (!Number.isFinite(createdAtMs) || !Number.isFinite(ackedAtMs)) return true;
    return ackedAtMs - createdAtMs > thresholds.ackThresholdSec * 1000;
  });
  const totalWindowStatuses = profileCommandStatus.filter((status) => {
    const createdAtMs = new Date(status.created_at || "").getTime();
    return Number.isFinite(createdAtMs) && createdAtMs >= windowStartMs;
  });
  const failedWindowStatuses = totalWindowStatuses.filter((status) => status.status === "FAILED");
  const failedRatio =
    totalWindowStatuses.length > 0 ? failedWindowStatuses.length / totalWindowStatuses.length : 0;

  let severity = "NONE";
  const checks = [];
  const marketOpen = marketState[profile].open;

  if (activeInstances.length === 0) {
    severity = getWorstSeverity(severity, "S2");
    checks.push({
      code: "NO_ACTIVE_INSTANCES",
      severity: "S2",
      message: "No active bot instances for this profile",
      profile,
      details: {
        totalInstances: instances.length,
        activeInstances: activeInstances.length,
      },
    });
  }

  const staleInstances = activeInstances.filter((instance) => {
    const hbMs = new Date(instance.last_heartbeat_at || "").getTime();
    if (!Number.isFinite(hbMs)) return true;
    return nowMs - hbMs > thresholds.heartbeatThresholdSec * 1000;
  });
  if (staleInstances.length > 0) {
    const staleSeverity = marketOpen ? "S1" : "S2";
    severity = getWorstSeverity(severity, staleSeverity);
    checks.push({
      code: "STALE_HEARTBEAT",
      severity: staleSeverity,
      message: marketOpen
        ? "Heartbeat stale above threshold"
        : "Heartbeat stale while market closed (downgraded)",
      profile,
      details: {
        staleInstances: staleInstances.length,
        thresholdSec: thresholds.heartbeatThresholdSec,
        marketOpen,
      },
    });
  }

  if (stalePending.length > 0) {
    severity = getWorstSeverity(severity, "S1");
    checks.push({
      code: "PENDING_TIMEOUT",
      severity: "S1",
      message: "Pending commands exceeded timeout threshold",
      profile,
      details: {
        stalePending: stalePending.length,
        thresholdSec: thresholds.pendingThresholdSec,
      },
    });
  }

  if (ackBreaches.length > 0) {
    severity = getWorstSeverity(severity, "S2");
    checks.push({
      code: "ACK_LATENCY",
      severity: "S2",
      message: "ACK latency above threshold in current window",
      profile,
      details: {
        breaches: ackBreaches.length,
        samples: ackInWindow.length,
        thresholdSec: thresholds.ackThresholdSec,
      },
    });
  }

  if (failedRatio >= 0.2 && totalWindowStatuses.length >= 5) {
    severity = getWorstSeverity(severity, "S2");
    checks.push({
      code: "FAILED_RATIO",
      severity: "S2",
      message: "Failed command ratio above 20% in current window",
      profile,
      details: {
        failed: failedWindowStatuses.length,
        total: totalWindowStatuses.length,
        ratio: Number(failedRatio.toFixed(4)),
      },
    });
  } else if (failedWindowStatuses.length > 0) {
    severity = getWorstSeverity(severity, "S3");
    checks.push({
      code: "FAILED_RATIO",
      severity: "S3",
      message: "Failed commands detected in current window",
      profile,
      details: {
        failed: failedWindowStatuses.length,
        total: totalWindowStatuses.length,
        ratio: Number(failedRatio.toFixed(4)),
      },
    });
  }

  return {
    status: severityToStatus(severity),
    severity,
    marketOpen,
    counts: {
      bots: botIds.size,
      botAccounts: accountIds.length,
      instances: instances.length,
      activeInstances: activeInstances.length,
      staleInstances: staleInstances.length,
      stalePending: stalePending.length,
      ackSamples: ackInWindow.length,
      ackBreaches: ackBreaches.length,
      failedWindow: failedWindowStatuses.length,
      totalWindowStatuses: totalWindowStatuses.length,
    },
    checks,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...process.env, ...loadEnvFile(path.join(process.cwd(), ".env.local")) };

  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const outputPath =
    args.output ||
    path.join(process.cwd(), "docs", "reports", `bot-slo-monitor-${Date.now()}.json`);
  const windowMin = Math.max(1, asNumber(args["window-min"], 15));
  const heartbeatThresholdSec = Math.max(1, asNumber(args["heartbeat-threshold-sec"], 120));
  const ackThresholdSec = Math.max(1, asNumber(args["ack-threshold-sec"], 60));
  const pendingThresholdSec = Math.max(1, asNumber(args["pending-threshold-sec"], 60));
  const marketPolicy = String(args["market-policy"] || "auto").toLowerCase();
  const timezone = args.timezone || "America/Puerto_Rico";

  if (!["auto", "force-open", "force-closed"].includes(marketPolicy)) {
    throw new Error("Invalid market-policy. Use auto|force-open|force-closed");
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const startedAt = isoNow();
  const now = new Date();
  const nowMs = now.getTime();
  const windowStartMs = nowMs - windowMin * 60 * 1000;
  const clock = getZonedClock(now, timezone);
  const marketState = getMarketState({ policy: marketPolicy, clock });

  const report = {
    generatedAt: startedAt,
    status: "PASS",
    severity: "NONE",
    config: {
      baseUrl,
      windowMin,
      heartbeatThresholdSec,
      ackThresholdSec,
      pendingThresholdSec,
      marketPolicy,
      timezone,
    },
    marketState: {
      clock,
      policyApplied: marketPolicy,
      forex: marketState.forex,
      futuros: marketState.futuros,
    },
    checks: [],
    byProfile: {
      forex: null,
      futuros: null,
    },
    recommendedActions: [],
    alertDispatch: {
      attempted: false,
      sent: false,
      details: null,
    },
    errors: [],
  };

  try {
    const [{ data: bots, error: botsError }, { data: botAccounts, error: accountsError }, { data: botInstances, error: instancesError }, { data: commandStatus, error: commandStatusError }] = await Promise.all([
      supabase.from("bots").select("id,name,user_id"),
      supabase.from("bot_accounts").select("id,bot_id,user_id"),
      supabase.from("bot_instances").select("id,bot_account_id,status,last_heartbeat_at"),
      supabase
        .from("bot_command_status")
        .select("id,command_id,bot_account_id,status,created_at,acked_at"),
    ]);

    if (botsError) throw botsError;
    if (accountsError) throw accountsError;
    if (instancesError) throw instancesError;
    if (commandStatusError) throw commandStatusError;

    const groupedBotIds = { forex: new Set(), futuros: new Set() };
    for (const bot of bots || []) {
      const profile = resolveProfile(bot.name);
      if (!profile) continue;
      groupedBotIds[profile].add(bot.id);
    }

    const thresholds = {
      heartbeatThresholdSec,
      ackThresholdSec,
      pendingThresholdSec,
    };

    for (const profile of ["forex", "futuros"]) {
      const assessment = buildProfileAssessment({
        profile,
        botIds: groupedBotIds[profile],
        botAccounts: botAccounts || [],
        botInstances: botInstances || [],
        commandStatus: commandStatus || [],
        thresholds,
        marketState,
        nowMs,
        windowStartMs,
      });
      report.byProfile[profile] = assessment;
      report.severity = getWorstSeverity(report.severity, assessment.severity);
      report.checks.push(...assessment.checks);
    }

    report.status = severityToStatus(report.severity);
    report.recommendedActions = summarizeRecommendations(report.checks);
  } catch (error) {
    report.status = "FAIL";
    report.severity = "S1";
    report.errors.push(error instanceof Error ? error.message : String(error));
  }

  if (report.severity === "S1" || report.severity === "S2") {
    report.alertDispatch.attempted = true;
    report.alertDispatch.details = await dispatchAlert({
      baseUrl,
      token: env.OPS_ALERT_TOKEN,
      report,
    });
    report.alertDispatch.sent = Boolean(report.alertDispatch.details?.sent);
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[bot-slo-monitor] report: ${outputPath}`);
  console.log(`[bot-slo-monitor] status: ${report.status} severity: ${report.severity}`);

  if (report.status === "FAIL") {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("[bot-slo-monitor] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});

