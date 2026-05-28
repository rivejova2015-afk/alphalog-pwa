#!/usr/bin/env node
// One-shot codemod: replaces console.error(...) calls in API route handlers
// with logError(...) tagged by module + component derived from the file path.
//
// Patterns handled (in order of specificity):
//   1. console.error('[Tag] message:', err)         → logError('Tag', { ... })
//   2. console.error(`[Tag] ${tpl}:`, err)          → logError('Tag', { ... })
//   3. console.error('plain text', err)             → logError('PathDerived', { ... })
//   4. console.error('text only')                   → logError('PathDerived', { ... })
//
// Unhandled patterns are left alone and reported at the end for manual review.
// Also auto-injects `import { logError } from '@/lib/log';` after the last
// import line if not already present.
//
// Usage: node scripts/migrate-console-error-to-logerror.mjs [path...]
//   Defaults to src/app/api when no path given.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const targetGlob = args.length > 0 ? args : ["src/app/api"];

// Discover files via grep so we don't depend on glob libs.
const grepOut = execSync(
  `grep -rln "console\\.error" ${targetGlob.map((p) => `'${p}'`).join(" ")}`,
  { encoding: "utf8" },
);
const files = grepOut.split("\n").filter((f) => f.endsWith("route.ts"));

const LOG_IMPORT = `import { logError } from "@/lib/log";`;

// Path → CamelCase tag derived from the route segment.
//   src/app/api/cron/business/alerts/route.ts → CronBusinessAlerts
function tagFromPath(filePath) {
  const m = filePath.match(/src\/app\/api\/(.+)\/route\.ts$/);
  if (!m) return "Unknown";
  return m[1]
    .split("/")
    .filter((s) => !s.startsWith("[") && !s.endsWith("]"))
    .map((s) => s.replace(/(?:^|[-_])(.)/g, (_, c) => c.toUpperCase()))
    .join("");
}

function componentFromPath(filePath) {
  const m = filePath.match(/src\/app\/api\/(.+)\/route\.ts$/);
  return m ? m[1].replace(/\//g, ".") : filePath;
}

// Order matters — most specific first.
const PATTERNS = [
  // [Tag] message style with template literal: console.error(`[Tag] ${...}:`, err)
  // Capture: tag (1), full message text (2), err arg (3)
  {
    name: "bracket-template",
    re: /console\.error\(\s*`\[([^\]]+)\]\s*(.+?)`\s*,\s*([^)]+?)\s*\)\s*;?/g,
    build: (tag, msg, errArg) =>
      `logError("${tag}", { component: "{COMPONENT}", message: \`${msg}: \${${errArg.trim()} instanceof Error ? ${errArg.trim()}.message : String(${errArg.trim()})}\` });`,
  },
  // [Tag] message style with simple string: console.error('[Tag] message:', err)
  {
    name: "bracket-string-err",
    re: /console\.error\(\s*['"]\[([^\]]+)\]\s+(.+?)['"]\s*,\s*([^)]+?)\s*\)\s*;?/g,
    build: (tag, msg, errArg) =>
      `logError("${tag}", { component: "{COMPONENT}", message: "${msg.replace(/"/g, '\\"')}", error: ${errArg.trim()} instanceof Error ? ${errArg.trim()}.message : String(${errArg.trim()}) });`,
  },
  // [Tag] message no err arg
  {
    name: "bracket-string-only",
    re: /console\.error\(\s*['"]\[([^\]]+)\]\s+(.+?)['"]\s*\)\s*;?/g,
    build: (tag, msg) =>
      `logError("${tag}", { component: "{COMPONENT}", message: "${msg.replace(/"/g, '\\"')}" });`,
  },
];

let totalSites = 0;
let totalReplaced = 0;
const unhandled = [];
const filesChanged = [];

for (const filePath of files) {
  const original = readFileSync(filePath, "utf8");
  let modified = original;
  let fileReplacements = 0;
  const component = componentFromPath(filePath);
  const fallbackTag = tagFromPath(filePath);

  // Pass 1: tagged-bracket patterns (most specific).
  for (const pat of PATTERNS) {
    modified = modified.replace(pat.re, (match, ...captured) => {
      const built = pat.build(...captured).replace("{COMPONENT}", component);
      fileReplacements += 1;
      totalReplaced += 1;
      return built;
    });
  }

  // Pass 2: untagged catch-all with err arg.
  modified = modified.replace(
    /console\.error\(\s*(['"`])([^'"`]+?)\1\s*,\s*([^)]+?)\s*\)\s*;?/g,
    (match, _q, msg, errArg) => {
      fileReplacements += 1;
      totalReplaced += 1;
      return `logError("${fallbackTag}", { component: "${component}", message: ${JSON.stringify(msg)}, error: ${errArg.trim()} instanceof Error ? ${errArg.trim()}.message : String(${errArg.trim()}) });`;
    },
  );

  // Pass 3: untagged single string.
  modified = modified.replace(
    /console\.error\(\s*(['"`])([^'"`]+?)\1\s*\)\s*;?/g,
    (match, _q, msg) => {
      fileReplacements += 1;
      totalReplaced += 1;
      return `logError("${fallbackTag}", { component: "${component}", message: ${JSON.stringify(msg)} });`;
    },
  );

  // Count any remaining console.error sites we couldn't transform.
  const remaining = (modified.match(/console\.error/g) ?? []).length;
  const originalSites = (original.match(/console\.error/g) ?? []).length;
  totalSites += originalSites;
  if (remaining > 0) {
    unhandled.push({ file: filePath, remaining });
  }

  if (modified !== original) {
    // Inject import if not present.
    if (!modified.includes(`from "@/lib/log"`) && !modified.includes(`from '@/lib/log'`)) {
      // Place after the last existing `import` statement at the top of the file.
      const importMatches = [...modified.matchAll(/^import\s.+?;?$/gm)];
      if (importMatches.length > 0) {
        const last = importMatches[importMatches.length - 1];
        const insertAt = (last.index ?? 0) + last[0].length;
        modified = modified.slice(0, insertAt) + "\n" + LOG_IMPORT + modified.slice(insertAt);
      } else {
        modified = LOG_IMPORT + "\n" + modified;
      }
    }
    writeFileSync(filePath, modified, "utf8");
    filesChanged.push({ file: filePath, replaced: fileReplacements });
  }
}

console.log(`\n=== migrate-console-error-to-logerror ===`);
console.log(`Files scanned:    ${files.length}`);
console.log(`Files changed:    ${filesChanged.length}`);
console.log(`Sites total:      ${totalSites}`);
console.log(`Sites replaced:   ${totalReplaced}`);
console.log(`Sites remaining:  ${totalSites - totalReplaced}`);

if (unhandled.length > 0) {
  console.log(`\nFiles with unhandled patterns (manual cleanup needed):`);
  unhandled.slice(0, 30).forEach((u) => console.log(`  ${u.file}  (${u.remaining} left)`));
  if (unhandled.length > 30) console.log(`  ... ${unhandled.length - 30} more`);
}

process.exit(0);
