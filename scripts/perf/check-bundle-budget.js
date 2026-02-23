#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG_PATH = path.join(
  process.cwd(),
  "scripts",
  "perf",
  "bundle-budget.config.json"
);

function formatKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inline] = token.slice(2).split("=");
    if (inline !== undefined) {
      out[key] = inline;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
      continue;
    }
    out[key] = next;
    index += 1;
  }
  return out;
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Bundle budget config not found: ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function collectJsFiles(dirPath, bucket = []) {
  if (!fs.existsSync(dirPath)) return bucket;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, bucket);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const stat = fs.statSync(fullPath);
      bucket.push({
        path: fullPath,
        sizeBytes: stat.size,
      });
    }
  }
  return bucket;
}

function evaluateBudgets(summary, config) {
  const failures = [];

  if (config.maxTotalJsKb && summary.totalJsKb > config.maxTotalJsKb) {
    failures.push(
      `Total JS ${summary.totalJsKb.toFixed(2)}KB exceeds maxTotalJsKb ${config.maxTotalJsKb}KB`
    );
  }

  if (config.maxLargestChunkKb && summary.largestChunkKb > config.maxLargestChunkKb) {
    failures.push(
      `Largest chunk ${summary.largestChunkKb.toFixed(2)}KB exceeds maxLargestChunkKb ${config.maxLargestChunkKb}KB`
    );
  }

  if (config.maxChunkCount && summary.chunkCount > config.maxChunkCount) {
    failures.push(
      `Chunk count ${summary.chunkCount} exceeds maxChunkCount ${config.maxChunkCount}`
    );
  }

  return failures;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config
    ? path.resolve(process.cwd(), args.config)
    : DEFAULT_CONFIG_PATH;
  const nextDir = args.nextDir
    ? path.resolve(process.cwd(), args.nextDir)
    : path.join(process.cwd(), ".next");
  const chunksDir = path.join(nextDir, "static", "chunks");

  const config = readConfig(configPath);
  const jsFiles = collectJsFiles(chunksDir);

  if (jsFiles.length === 0) {
    throw new Error(`No JS chunks found in ${chunksDir}. Run npm run build first.`);
  }

  jsFiles.sort((left, right) => right.sizeBytes - left.sizeBytes);
  const totalBytes = jsFiles.reduce((sum, item) => sum + item.sizeBytes, 0);
  const largest = jsFiles[0];

  const summary = {
    chunkCount: jsFiles.length,
    totalJsKb: totalBytes / 1024,
    largestChunkKb: largest.sizeBytes / 1024,
  };

  console.log("[bundle-budget] summary");
  console.log(
    JSON.stringify(
      {
        chunkCount: summary.chunkCount,
        totalJsKb: Number(summary.totalJsKb.toFixed(2)),
        largestChunkKb: Number(summary.largestChunkKb.toFixed(2)),
      },
      null,
      2
    )
  );

  console.log("[bundle-budget] top 10 largest chunks");
  jsFiles.slice(0, 10).forEach((file, index) => {
    const rel = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    console.log(`${index + 1}. ${rel} -> ${formatKb(file.sizeBytes)}KB`);
  });

  const failures = evaluateBudgets(summary, config);
  if (failures.length > 0) {
    console.error("[bundle-budget] FAILED");
    failures.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  console.log("[bundle-budget] PASSED");
}

main();
