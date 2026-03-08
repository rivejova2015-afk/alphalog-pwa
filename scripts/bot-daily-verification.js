#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

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

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveProfileFromName(name) {
  const normalized = normalizeName(name);
  if (normalized.includes("forex")) return "forex";
  if (normalized.includes("futuro")) return "futuros";
  return null;
}

function zonedDateKey(date, timeZone) {
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

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
  return {
    exitCode: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

async function runHealthCheck(baseUrl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const json = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      statusCode: response.status,
      payload: json,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function persistDailyReport({
  env,
  report,
  reportPath,
  sloPayload,
}) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = env.BOT_OPS_USER_ID;

  if (!supabaseUrl || !serviceRoleKey || !userId) {
    return {
      saved: false,
      reason: "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or BOT_OPS_USER_ID",
    };
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: bots, error: botsError } = await supabase
      .from("bots")
      .select("id,name")
      .eq("user_id", userId);

    if (botsError) {
      return { saved: false, reason: `bots query failed: ${botsError.message}` };
    }
    if (!bots || bots.length === 0) {
      return { saved: false, reason: "No bots found for BOT_OPS_USER_ID" };
    }

    const candidates = [];
    for (const bot of bots) {
      const profile = resolveProfileFromName(bot.name);
      if (!profile) continue;
      if (candidates.some((item) => item.profile === profile)) continue;
      candidates.push({ botId: bot.id, profile });
    }

    if (candidates.length === 0) {
      return { saved: false, reason: "No Bot Forex/Bot Futuros profiles found for BOT_OPS_USER_ID" };
    }

    const inserts = candidates.map((candidate) => ({
      bot_id: candidate.botId,
      event_type: "DAILY_VERIFICATION",
      payload: {
        source: "bot_daily_verification",
        profile: candidate.profile,
        generatedAt: report.generatedAt,
        overallStatus: report.overallStatus,
        marketPolicy: report.marketPolicy,
        recommendations: report.recommendations,
        artifacts: report.artifacts,
        reportPath: path.basename(reportPath),
        health: report.steps.health,
        sloSummary: {
          status: sloPayload?.status || null,
          severity: sloPayload?.severity || null,
          byProfile: sloPayload?.byProfile || null,
        },
      },
    }));

    const { error: insertError } = await supabase.from("bot_events").insert(inserts);
    if (insertError) {
      return { saved: false, reason: `bot_events insert failed: ${insertError.message}` };
    }

    return {
      saved: true,
      profiles: candidates.map((item) => item.profile),
      rows: inserts.length,
    };
  } catch (error) {
    return {
      saved: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = {
    ...process.env,
    ...loadEnvFile(path.join(process.cwd(), ".env.local")),
  };
  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const timeZone = args.timezone || "America/Puerto_Rico";
  const reportsDir = path.resolve(args.reportsDir || path.join(process.cwd(), "docs", "reports"));
  const marketPolicy = args.marketPolicy || "auto";
  const healthTimeoutMs = Number.isFinite(Number(args.healthTimeoutMs))
    ? Math.max(1000, Number(args.healthTimeoutMs))
    : 15000;
  const runE2E = String(args.runE2E || "false").toLowerCase() === "true";
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const dateKey = zonedDateKey(now, timeZone);

  ensureDir(reportsDir);

  const verificationPath =
    args.output || path.join(reportsDir, `bot-daily-verification-${timestamp}.json`);
  const sloPath = path.join(reportsDir, `bot-slo-monitor-${timestamp}-daily.json`);
  const summaryPath = path.join(reportsDir, `bot-ops-daily-summary-${dateKey.replace(/-/g, "")}.json`);

  const report = {
    generatedAt: now.toISOString(),
    baseUrl,
    timezone: timeZone,
    marketPolicy,
    overallStatus: "PASS",
    steps: {
      health: null,
      sloMonitor: null,
      dailySummary: null,
      e2eSmoke: null,
    },
    artifacts: {
      verification: path.relative(process.cwd(), verificationPath),
      sloReport: path.relative(process.cwd(), sloPath),
      dailySummary: path.relative(process.cwd(), summaryPath),
    },
    recommendations: [],
    persistence: {
      saved: false,
      reason: "not_attempted",
    },
  };

  report.steps.health = await runHealthCheck(baseUrl, healthTimeoutMs);
  if (!report.steps.health.ok) {
    report.overallStatus = "FAIL";
    report.recommendations.push("Revisar /api/health y logs del deployment.");
  } else {
    const healthStatus = String(report.steps.health.payload?.status || "").toLowerCase();
    if (healthStatus === "degraded" && report.overallStatus === "PASS") {
      report.overallStatus = "DEGRADED";
      report.recommendations.push("Revisar checks degradados en /api/health.");
    } else if (healthStatus === "error") {
      report.overallStatus = "FAIL";
      report.recommendations.push("Atender error en /api/health antes de abrir mercado.");
    }
  }

  const sloResult = runNodeScript(path.join(process.cwd(), "scripts", "bot-slo-monitor.js"), [
    "--baseUrl",
    baseUrl,
    "--output",
    sloPath,
    "--market-policy",
    marketPolicy,
    "--timezone",
    timeZone,
  ]);
  report.steps.sloMonitor = {
    exitCode: sloResult.exitCode,
    output: (sloResult.stdout + sloResult.stderr).trim(),
    reportFile: path.relative(process.cwd(), sloPath),
  };
  if (sloResult.exitCode === 2 && report.overallStatus === "PASS") {
    report.overallStatus = "DEGRADED";
    report.recommendations.push("SLO monitor detecto severidad S1; revisar reporte y auto-recovery.");
  } else if (sloResult.exitCode !== 0 && sloResult.exitCode !== 2) {
    report.overallStatus = "FAIL";
    report.recommendations.push("SLO monitor fallo; validar variables de entorno y conectividad Supabase.");
  }

  const summaryResult = runNodeScript(path.join(process.cwd(), "scripts", "bot-ops-daily-summary.js"), [
    "--timezone",
    timeZone,
    "--reportsDir",
    reportsDir,
    "--output",
    summaryPath,
    "--date",
    dateKey,
  ]);
  report.steps.dailySummary = {
    exitCode: summaryResult.exitCode,
    output: (summaryResult.stdout + summaryResult.stderr).trim(),
    reportFile: path.relative(process.cwd(), summaryPath),
  };
  if (summaryResult.exitCode !== 0) {
    report.overallStatus = "FAIL";
    report.recommendations.push("No se pudo generar resumen diario; revisar script bot-ops-daily-summary.");
  }

  const sloPayload = readJsonSafe(sloPath);
  report.persistence = await persistDailyReport({
    env,
    report,
    reportPath: verificationPath,
    sloPayload,
  });

  if (runE2E) {
    const smokeResult = spawnSync(
      "npm",
      ["run", "test:e2e:smoke:remote"],
      {
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl },
        encoding: "utf8",
      }
    );
    report.steps.e2eSmoke = {
      exitCode: typeof smokeResult.status === "number" ? smokeResult.status : 1,
      output: `${smokeResult.stdout || ""}${smokeResult.stderr || ""}`.trim(),
    };
    if (report.steps.e2eSmoke.exitCode !== 0) {
      report.overallStatus = "FAIL";
      report.recommendations.push("Smoke remoto fallo; revisar tests/e2e y estado de auth remoto.");
    }
  }

  if (report.recommendations.length === 0) {
    report.recommendations.push("Operacion estable. Continuar monitoreo cada 15 minutos.");
  }

  fs.writeFileSync(verificationPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[bot-daily-verification] report: ${verificationPath}`);
  console.log(`[bot-daily-verification] overall: ${report.overallStatus}`);

  if (report.overallStatus === "FAIL") {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error("[bot-daily-verification] fatal:", error instanceof Error ? error.message : error);
  process.exit(1);
});
