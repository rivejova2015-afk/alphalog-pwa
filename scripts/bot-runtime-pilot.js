#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoNow() {
  return new Date().toISOString();
}

function ageSeconds(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / 1000));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const durationMinutes = asNumber(args["duration-min"], 15);
  const intervalSeconds = asNumber(args["interval-sec"], 60);
  const heartbeatThresholdSec = asNumber(args["heartbeat-threshold-sec"], 120);
  const pendingThresholdSec = asNumber(args["pending-threshold-sec"], 60);
  const allowNoInstances = String(args["allow-no-instances"] || "false") === "true";
  const outputPath =
    args.output ||
    path.join(
      process.cwd(),
      `bot-runtime-pilot-${Date.now()}.json`
    );

  const envFile = path.join(process.cwd(), ".env.local");
  const env = { ...process.env, ...loadEnvFile(envFile) };

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const report = {
    startedAt: isoNow(),
    endedAt: null,
    config: {
      durationMinutes,
      intervalSeconds,
      heartbeatThresholdSec,
      pendingThresholdSec,
      allowNoInstances,
    },
    samples: [],
    summary: null,
  };

  const startTime = Date.now();
  const stopTime = startTime + durationMinutes * 60 * 1000;
  let sampleIndex = 0;

  console.log(`[pilot] started ${report.startedAt}`);
  console.log(
    `[pilot] config duration=${durationMinutes}m interval=${intervalSeconds}s hb>${heartbeatThresholdSec}s pending>${pendingThresholdSec}s`
  );

  while (Date.now() < stopTime) {
    sampleIndex += 1;
    const sampledAt = isoNow();
    const pendingCutoffIso = new Date(
      Date.now() - pendingThresholdSec * 1000
    ).toISOString();

    const [instancesRes, telemetryRes, pendingRes, failedRes] =
      await Promise.all([
        supabase
          .from("bot_instances")
          .select("id, instance_id, bot_account_id, status, last_heartbeat_at, updated_at"),
        supabase
          .from("bot_telemetry")
          .select("id, bot_account_id, last_heartbeat_ts, updated_at, equity, balance"),
        supabase
          .from("bot_command_status")
          .select("id, command_id, bot_account_id, status, created_at")
          .eq("status", "PENDING")
          .lt("created_at", pendingCutoffIso),
        supabase
          .from("bot_command_status")
          .select("id, command_id, bot_account_id, status, updated_at")
          .eq("status", "FAILED")
          .gte("updated_at", report.startedAt),
      ]);

    if (instancesRes.error) throw instancesRes.error;
    if (telemetryRes.error) throw telemetryRes.error;
    if (pendingRes.error) throw pendingRes.error;
    if (failedRes.error) throw failedRes.error;

    const instances = instancesRes.data || [];
    const telemetryRows = telemetryRes.data || [];
    const stalePending = pendingRes.data || [];
    const failedSinceStart = failedRes.data || [];

    const telemetryMap = new Map(
      telemetryRows.map((row) => [row.bot_account_id, row])
    );

    const staleInstances = [];
    const missingTelemetryInstances = [];

    for (const instance of instances) {
      const hbAge = ageSeconds(instance.last_heartbeat_at);
      if (hbAge === null || hbAge > heartbeatThresholdSec) {
        staleInstances.push({
          instance_id: instance.instance_id,
          bot_account_id: instance.bot_account_id,
          heartbeatAgeSec: hbAge,
        });
      }

      if (!telemetryMap.has(instance.bot_account_id)) {
        missingTelemetryInstances.push({
          instance_id: instance.instance_id,
          bot_account_id: instance.bot_account_id,
        });
      }
    }

    const sample = {
      index: sampleIndex,
      sampledAt,
      counts: {
        instances: instances.length,
        telemetryRows: telemetryRows.length,
        staleInstances: staleInstances.length,
        missingTelemetryInstances: missingTelemetryInstances.length,
        stalePendingCommands: stalePending.length,
        failedCommandsSinceStart: failedSinceStart.length,
      },
      staleInstances,
      stalePendingCommands: stalePending.map((row) => ({
        command_id: row.command_id,
        bot_account_id: row.bot_account_id,
        created_at: row.created_at,
      })),
      alerts: [],
    };

    if (instances.length === 0) {
      sample.alerts.push({
        severity: "S2",
        code: "NO_INSTANCES",
        message: "No bot_instances found. Pilot cannot validate live runtime.",
      });
    }
    if (sample.counts.staleInstances > 0) {
      sample.alerts.push({
        severity: "S1",
        code: "STALE_HEARTBEAT",
        message: `${sample.counts.staleInstances} instances exceed heartbeat threshold`,
      });
    }
    if (sample.counts.stalePendingCommands > 0) {
      sample.alerts.push({
        severity: "S1",
        code: "PENDING_COMMAND_TIMEOUT",
        message: `${sample.counts.stalePendingCommands} pending commands exceeded threshold`,
      });
    }
    if (sample.counts.failedCommandsSinceStart > 0) {
      sample.alerts.push({
        severity: "S2",
        code: "FAILED_COMMANDS",
        message: `${sample.counts.failedCommandsSinceStart} failed commands since pilot start`,
      });
    }
    if (sample.counts.missingTelemetryInstances > 0) {
      sample.alerts.push({
        severity: "S2",
        code: "MISSING_TELEMETRY",
        message: `${sample.counts.missingTelemetryInstances} instances have no telemetry row`,
      });
    }

    report.samples.push(sample);

    const severityLine = sample.alerts.length
      ? sample.alerts.map((a) => `${a.severity}:${a.code}`).join(", ")
      : "OK";
    console.log(
      `[pilot][${sample.index}] instances=${sample.counts.instances} stale=${sample.counts.staleInstances} pendingTimeout=${sample.counts.stalePendingCommands} failed=${sample.counts.failedCommandsSinceStart} alerts=${severityLine}`
    );

    if (Date.now() + intervalSeconds * 1000 > stopTime) break;
    await sleep(intervalSeconds * 1000);
  }

  report.endedAt = isoNow();

  const allAlerts = report.samples.flatMap((sample) =>
    sample.alerts.map((alert) => ({ ...alert, sampleIndex: sample.index }))
  );
  const hasS1 = allAlerts.some((a) => a.severity === "S1");
  const hasInstances = report.samples.some((s) => s.counts.instances > 0);

  report.summary = {
    totalSamples: report.samples.length,
    hasInstances,
    hasS1,
    alertsBySeverity: {
      S1: allAlerts.filter((a) => a.severity === "S1").length,
      S2: allAlerts.filter((a) => a.severity === "S2").length,
      S3: allAlerts.filter((a) => a.severity === "S3").length,
    },
    status: hasS1
      ? "FAIL"
      : !hasInstances && !allowNoInstances
        ? "BLOCKED_NO_INSTANCES"
        : "PASS",
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[pilot] report written: ${outputPath}`);
  console.log(`[pilot] status: ${report.summary.status}`);

  if (report.summary.status === "FAIL") process.exitCode = 2;
  if (report.summary.status === "BLOCKED_NO_INSTANCES") process.exitCode = 3;
}

main().catch((error) => {
  console.error("[pilot] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
