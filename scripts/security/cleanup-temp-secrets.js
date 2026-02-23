#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

const DEFAULT_REGEX = /^alphalog_mt5_webhook_secret_\d+\.txt$/;

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

function cleanupTempSecrets(options = {}) {
  const {
    dryRun = false,
    tempDir = os.tmpdir(),
    matcher = DEFAULT_REGEX,
    logger = console,
  } = options;

  const files = fs
    .readdirSync(tempDir)
    .filter((name) => matcher.test(name))
    .map((name) => path.join(tempDir, name));

  const deleted = [];
  const failed = [];

  for (const fullPath of files) {
    if (dryRun) {
      deleted.push(fullPath);
      continue;
    }

    try {
      fs.rmSync(fullPath, { force: true });
      deleted.push(fullPath);
    } catch (error) {
      failed.push({
        path: fullPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    dryRun,
    tempDir,
    matched: files.length,
    deleted,
    failed,
  };

  logger.info(
    `[cleanup-temp-secrets] matched=${summary.matched} deleted=${summary.deleted.length} failed=${summary.failed.length}`
  );
  return summary;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = String(args["dry-run"] || "false") === "true";
  const summary = cleanupTempSecrets({ dryRun });
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.failed.length > 0) process.exitCode = 1;
}

module.exports = {
  cleanupTempSecrets,
};

