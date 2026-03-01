#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isoNow() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runProcess(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });
    child.on("exit", (code) => resolve(code || 0));
    child.on("error", () => resolve(1));
  });
}

function runVercelProdScript({ scriptName, baseUrl, reportPath, extraArgs = [] }) {
  if (process.platform === "win32") {
    const relativeOutput = path
      .relative(process.cwd(), reportPath)
      .replace(/\\/g, "/");
    const command = [
      "vercel",
      "env",
      "run",
      "-e",
      "production",
      "--",
      "npm",
      "run",
      scriptName,
      "--",
      "--baseUrl",
      baseUrl,
      "--output",
      relativeOutput,
      ...extraArgs,
    ].join(" ");
    return runProcess("cmd", ["/c", command]);
  }

  return runProcess("vercel", [
    "env",
    "run",
    "-e",
    "production",
    "--",
    "npm",
    "run",
    scriptName,
    "--",
    "--baseUrl",
    baseUrl,
    "--output",
    reportPath,
    ...extraArgs,
  ]);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function statusToSeverity(status) {
  if (status === "FAIL") return "S1";
  if (status === "DEGRADED" || status === "CHECK_REQUIRED") return "S2";
  if (status === "PASS") return "NONE";
  return "S2";
}

function worstSeverity(current, next) {
  return SEVERITY_ORDER[next] > SEVERITY_ORDER[current] ? next : current;
}

function severityToStatus(severity) {
  if (severity === "S1") return "FAIL";
  if (severity === "S2" || severity === "S3") return "DEGRADED";
  return "PASS";
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const runs = Math.max(1, Math.floor(asNumber(args.runs, 12)));
  const intervalMin = Math.max(0, asNumber(args["interval-min"], 60));
  const outputDir = path.resolve(args.outputDir || path.join(process.cwd(), "docs", "reports"));
  const signedMode = String(args.signedMode || "auto").toLowerCase();
  const failFast = String(args.failFast || "false").toLowerCase() === "true";
  const failFastOn = String(args.failFastOn || "none").toLowerCase();
  const sloMarketPolicy = String(args.sloMarketPolicy || "auto").toLowerCase();

  ensureDir(outputDir);

  const startedAt = isoNow();
  const windowTag = String(Date.now());
  const summaryPath = path.join(outputDir, `bot-control-plane-window-${windowTag}.json`);
  const results = [];

  console.log(
    `[bot-control-plane-window] start runs=${runs} intervalMin=${intervalMin} signedMode=${signedMode} failFastOn=${failFastOn}`
  );

  for (let i = 1; i <= runs; i += 1) {
    const runStartedAt = isoNow();
    const smokeReportPath = path.join(outputDir, `bot-control-plane-smoke-${windowTag}-run${i}.json`);
    const sloReportPath = path.join(outputDir, `bot-slo-monitor-${windowTag}-run${i}.json`);

    let runMode = signedMode;
    if (signedMode === "auto") {
      runMode = process.env.MT5_WEBHOOK_SECRET ? "local" : "local-unsigned";
    }

    let smokeExitCode = 1;
    if (runMode === "vercel-prod") {
      smokeExitCode = await runVercelProdScript({
        scriptName: "ops:bot-control-plane-smoke",
        baseUrl,
        reportPath: smokeReportPath,
      });
    } else {
      const smokeArgs = [
        path.join(process.cwd(), "scripts", "bot-control-plane-smoke.js"),
        "--baseUrl",
        baseUrl,
        "--output",
        smokeReportPath,
      ];
      if (runMode === "local-unsigned") {
        smokeArgs.push("--skipSignedWebhook=true");
      }
      smokeExitCode = await runProcess(process.execPath, smokeArgs);
    }

    let sloExitCode = 1;
    const sloExtraArgs = ["--market-policy", sloMarketPolicy];
    if (runMode === "vercel-prod") {
      sloExitCode = await runVercelProdScript({
        scriptName: "ops:bot-slo-monitor",
        baseUrl,
        reportPath: sloReportPath,
        extraArgs: sloExtraArgs,
      });
    } else {
      const sloArgs = [
        path.join(process.cwd(), "scripts", "bot-slo-monitor.js"),
        "--baseUrl",
        baseUrl,
        "--output",
        sloReportPath,
        ...sloExtraArgs,
      ];
      sloExitCode = await runProcess(process.execPath, sloArgs);
    }

    const smokeReport = readJsonIfExists(smokeReportPath);
    const sloReport = readJsonIfExists(sloReportPath);
    const smokeSeverity = statusToSeverity(smokeReport?.status || "CHECK_REQUIRED");
    const sloSeverity = statusToSeverity(sloReport?.status || "DEGRADED");
    const overallSeverity = worstSeverity(smokeSeverity, sloSeverity);
    const overallStatus = severityToStatus(overallSeverity);

    const result = {
      run: i,
      mode: runMode,
      startedAt: runStartedAt,
      endedAt: isoNow(),
      exitCode: smokeExitCode || sloExitCode,
      status: overallStatus,
      severity: overallSeverity,
      smoke: {
        reportPath: smokeReportPath,
        status: smokeReport?.status || "MISSING_REPORT",
        severity: smokeSeverity,
        exitCode: smokeExitCode,
        cleanupOk: Boolean(smokeReport?.cleanup?.ok),
      },
      slo: {
        reportPath: sloReportPath,
        status: sloReport?.status || "MISSING_REPORT",
        severity: sloSeverity,
        exitCode: sloExitCode,
        alertAttempted: Boolean(sloReport?.alertDispatch?.attempted),
        alertSent: Boolean(sloReport?.alertDispatch?.sent),
      },
      signedWebhookOk:
        smokeReport?.checks?.webhookSigned?.ok === true
          ? true
          : smokeReport?.checks?.webhookSigned?.skipped
            ? "skipped"
            : false,
    };
    results.push(result);

    console.log(
      `[bot-control-plane-window] run=${result.run} status=${result.status} severity=${result.severity} smoke=${result.smoke.status} slo=${result.slo.status}`
    );

    const shouldFailFastBySeverity =
      (failFastOn === "s1" && result.severity === "S1") ||
      (failFastOn === "s2" && (result.severity === "S1" || result.severity === "S2")) ||
      (failFastOn === "any" && result.severity !== "NONE");

    if (failFast && result.status !== "PASS") {
      console.log("[bot-control-plane-window] failFast=true stopping window");
      break;
    }
    if (shouldFailFastBySeverity) {
      console.log(`[bot-control-plane-window] failFastOn=${failFastOn} triggered`);
      break;
    }

    if (i < runs && intervalMin > 0) {
      await sleep(intervalMin * 60 * 1000);
    }
  }

  const failedRuns = results.filter((row) => row.status !== "PASS");
  const summary = {
    startedAt,
    endedAt: isoNow(),
    baseUrl,
    runsRequested: runs,
    runsExecuted: results.length,
    intervalMin,
    signedMode,
    failFastOn,
    sloMarketPolicy,
    failFast,
    pass: failedRuns.length === 0,
    failedRuns: failedRuns.length,
    results,
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`[bot-control-plane-window] summary: ${summaryPath}`);
  console.log(`[bot-control-plane-window] pass=${summary.pass} failedRuns=${summary.failedRuns}`);

  if (!summary.pass) {
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(
    "[bot-control-plane-window] fatal:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
