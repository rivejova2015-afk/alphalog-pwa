#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function toDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toTimestamp(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function toRecordMap(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

function collectFilesByPrefix(dirPath, prefix) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => path.join(dirPath, name));
}

function withinTargetDate(payload, targetDate, timeZone) {
  const candidates = [
    payload?.generatedAt,
    payload?.startedAt,
    payload?.endedAt,
    payload?.config?.generatedAt,
  ];
  for (const candidate of candidates) {
    const ts = toTimestamp(candidate);
    if (!ts) continue;
    const key = toDateKey(new Date(ts), timeZone);
    if (key === targetDate) return true;
  }
  return false;
}

function parseDateArg(value, timeZone) {
  if (!value) return toDateKey(new Date(), timeZone);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return value;
  throw new Error("Invalid --date format. Use YYYY-MM-DD");
}

function pruneOldDailyReports(dirPath, keepDays) {
  if (!fs.existsSync(dirPath) || keepDays <= 0) return [];

  const files = fs
    .readdirSync(dirPath)
    .filter((name) => /^bot-ops-daily-summary-\d{8}\.json$/.test(name))
    .map((name) => path.join(dirPath, name));

  const now = Date.now();
  const cutoffMs = now - keepDays * 24 * 60 * 60 * 1000;
  const deleted = [];

  for (const file of files) {
    const payload = readJsonSafe(file);
    const ts = toTimestamp(payload?.generatedAt) || fs.statSync(file).mtimeMs;
    if (ts < cutoffMs) {
      fs.unlinkSync(file);
      deleted.push(path.basename(file));
    }
  }
  return deleted;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const timeZone = args.timezone || "America/Puerto_Rico";
  const reportsDir = path.resolve(args.reportsDir || path.join(process.cwd(), "docs", "reports"));
  const targetDate = parseDateArg(args.date, timeZone);
  const keepDays = Number.isFinite(Number(args.keepDays)) ? Math.max(0, Number(args.keepDays)) : 14;
  const outputPath =
    args.output ||
    path.join(reportsDir, `bot-ops-daily-summary-${targetDate.replace(/-/g, "")}.json`);

  ensureDir(reportsDir);

  const windowFiles = collectFilesByPrefix(reportsDir, "bot-control-plane-window-");
  const sloFiles = collectFilesByPrefix(reportsDir, "bot-slo-monitor-");
  const recoveryFiles = collectFilesByPrefix(reportsDir, "bot-auto-recovery-");

  const counts = {
    windowStatus: {},
    windowSeverity: {},
    sloStatus: {},
    sloSeverity: {},
    recoveryStatus: {},
  };

  const summary = {
    generatedAt: new Date().toISOString(),
    targetDate,
    timezone: timeZone,
    reportsScanned: {
      windows: windowFiles.length,
      slo: sloFiles.length,
      recovery: recoveryFiles.length,
    },
    windows: {
      considered: 0,
      failedRunsTotal: 0,
      passCount: 0,
      degradedCount: 0,
      failCount: 0,
      alertSentCount: 0,
    },
    slo: {
      considered: 0,
      alertAttemptedCount: 0,
      alertSentCount: 0,
      profiles: {
        forex: { pass: 0, degraded: 0, fail: 0 },
        futuros: { pass: 0, degraded: 0, fail: 0 },
      },
    },
    recovery: {
      considered: 0,
      triggeredCount: 0,
      dryRunCount: 0,
      noActionCount: 0,
      errorCount: 0,
    },
    distributions: {},
    files: {
      windows: [],
      slo: [],
      recovery: [],
    },
    housekeeping: {
      keepDays,
      deletedOldSummaries: [],
    },
  };

  for (const file of windowFiles) {
    const payload = readJsonSafe(file);
    if (!payload || !withinTargetDate(payload, targetDate, timeZone)) continue;
    summary.windows.considered += 1;
    summary.windows.failedRunsTotal += Number(payload.failedRuns || 0);
    summary.files.windows.push(path.basename(file));

    for (const run of payload.results || []) {
      const status = String(run.status || "UNKNOWN");
      const severity = String(run.severity || "NONE");
      increment(counts.windowStatus, status);
      increment(counts.windowSeverity, severity);
      if (run?.slo?.alertSent) summary.windows.alertSentCount += 1;
    }
  }

  summary.windows.passCount = counts.windowStatus.PASS || 0;
  summary.windows.degradedCount = counts.windowStatus.DEGRADED || 0;
  summary.windows.failCount = counts.windowStatus.FAIL || 0;

  for (const file of sloFiles) {
    const payload = readJsonSafe(file);
    if (!payload || !withinTargetDate(payload, targetDate, timeZone)) continue;
    summary.slo.considered += 1;
    summary.files.slo.push(path.basename(file));

    const status = String(payload.status || "UNKNOWN");
    const severity = String(payload.severity || "NONE");
    increment(counts.sloStatus, status);
    increment(counts.sloSeverity, severity);

    if (payload.alertDispatch?.attempted) summary.slo.alertAttemptedCount += 1;
    if (payload.alertDispatch?.sent) summary.slo.alertSentCount += 1;

    for (const profileKey of ["forex", "futuros"]) {
      const profile = payload.byProfile?.[profileKey];
      const profileStatus = String(profile?.status || "PASS").toLowerCase();
      if (profileStatus === "pass") summary.slo.profiles[profileKey].pass += 1;
      else if (profileStatus === "degraded") summary.slo.profiles[profileKey].degraded += 1;
      else summary.slo.profiles[profileKey].fail += 1;
    }
  }

  for (const file of recoveryFiles) {
    const payload = readJsonSafe(file);
    if (!payload || !withinTargetDate(payload, targetDate, timeZone)) continue;
    summary.recovery.considered += 1;
    summary.files.recovery.push(path.basename(file));

    const status = String(payload.status || "UNKNOWN");
    increment(counts.recoveryStatus, status);
  }

  summary.recovery.triggeredCount = counts.recoveryStatus.RECOVERY_TRIGGERED || 0;
  summary.recovery.dryRunCount = counts.recoveryStatus.DRY_RUN_MATCH || 0;
  summary.recovery.noActionCount = counts.recoveryStatus.NO_ACTION || 0;
  summary.recovery.errorCount = counts.recoveryStatus.ERROR || 0;

  summary.distributions = {
    windowStatus: toRecordMap(counts.windowStatus),
    windowSeverity: toRecordMap(counts.windowSeverity),
    sloStatus: toRecordMap(counts.sloStatus),
    sloSeverity: toRecordMap(counts.sloSeverity),
    recoveryStatus: toRecordMap(counts.recoveryStatus),
  };

  summary.housekeeping.deletedOldSummaries = pruneOldDailyReports(reportsDir, keepDays);

  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(`[bot-ops-daily-summary] report: ${outputPath}`);
  console.log(
    `[bot-ops-daily-summary] windows=${summary.windows.considered} slo=${summary.slo.considered} recovery=${summary.recovery.considered}`
  );
}

run().catch((error) => {
  console.error("[bot-ops-daily-summary] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
