#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

function getVercelExecutable() {
  return process.platform === "win32" ? "vercel.cmd" : "vercel";
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = args.baseUrl || "https://www.alphalog.io";
  const runs = Math.max(1, Math.floor(asNumber(args.runs, 12)));
  const intervalMin = Math.max(0, asNumber(args["interval-min"], 60));
  const outputDir = path.resolve(args.outputDir || path.join(process.cwd(), "docs", "reports"));
  const signedMode = String(args.signedMode || "auto").toLowerCase();
  const failFast = String(args.failFast || "false").toLowerCase() === "true";

  ensureDir(outputDir);

  const startedAt = isoNow();
  const windowTag = String(Date.now());
  const summaryPath = path.join(outputDir, `bot-control-plane-window-${windowTag}.json`);
  const results = [];

  console.log(
    `[bot-control-plane-window] start runs=${runs} intervalMin=${intervalMin} signedMode=${signedMode}`
  );

  for (let i = 1; i <= runs; i += 1) {
    const runStartedAt = isoNow();
    const reportPath = path.join(outputDir, `bot-control-plane-smoke-${windowTag}-run${i}.json`);

    let runMode = signedMode;
    if (signedMode === "auto") {
      runMode = process.env.MT5_WEBHOOK_SECRET ? "local" : "local-unsigned";
    }

    let exitCode = 1;
    if (runMode === "vercel-prod") {
      exitCode = await runProcess(getVercelExecutable(), [
        "env",
        "run",
        "-e",
        "production",
        "--",
        "npm",
        "run",
        "ops:bot-control-plane-smoke",
        "--",
        "--baseUrl",
        baseUrl,
        "--output",
        reportPath,
      ]);
    } else {
      const smokeArgs = [
        path.join(process.cwd(), "scripts", "bot-control-plane-smoke.js"),
        "--baseUrl",
        baseUrl,
        "--output",
        reportPath,
      ];
      if (runMode === "local-unsigned") {
        smokeArgs.push("--skipSignedWebhook=true");
      }
      exitCode = await runProcess(process.execPath, smokeArgs);
    }

    const report = readJsonIfExists(reportPath);
    const result = {
      run: i,
      mode: runMode,
      startedAt: runStartedAt,
      endedAt: isoNow(),
      exitCode,
      reportPath,
      status: report?.status || "MISSING_REPORT",
      cleanupOk: Boolean(report?.cleanup?.ok),
      signedWebhookOk:
        report?.checks?.webhookSigned?.ok === true
          ? true
          : report?.checks?.webhookSigned?.skipped
            ? "skipped"
            : false,
    };
    results.push(result);

    console.log(
      `[bot-control-plane-window] run=${result.run} status=${result.status} exitCode=${result.exitCode} signed=${result.signedWebhookOk}`
    );

    if (failFast && (exitCode !== 0 || result.status !== "PASS")) {
      console.log("[bot-control-plane-window] failFast=true stopping window");
      break;
    }

    if (i < runs && intervalMin > 0) {
      await sleep(intervalMin * 60 * 1000);
    }
  }

  const failedRuns = results.filter((row) => row.exitCode !== 0 || row.status !== "PASS");
  const summary = {
    startedAt,
    endedAt: isoNow(),
    baseUrl,
    runsRequested: runs,
    runsExecuted: results.length,
    intervalMin,
    signedMode,
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

