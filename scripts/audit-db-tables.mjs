#!/usr/bin/env node
// Audit script: cross-checks code's `.from('table')` usage against the live
// Supabase schema. Run via `npm run audit:tables`.
//
// Detects:
//   - code-tables-not-in-db: a .from() reference points at a table that
//     doesn't exist in Postgres → 100% guaranteed runtime error (or empty
//     silent fallback, which is the worst kind of bug).
//   - orphan-tables: tables that exist in DB but no code references → likely
//     dead schema that should be dropped or migrated.
//   - deprecated-references: .from() targets a table flagged in
//     src/lib/db/canonical-tables.ts as deprecated.
//
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, "../src");
const FROM_REGEX = /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/gi;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function scanCodeTables() {
  const map = new Map(); // table → Set<file>
  for (const file of walk(SRC_ROOT)) {
    const content = readFileSync(file, "utf8");
    FROM_REGEX.lastIndex = 0;
    let m;
    while ((m = FROM_REGEX.exec(content)) !== null) {
      const t = m[1];
      if (!map.has(t)) map.set(t, new Set());
      map.get(t).add(path.relative(SRC_ROOT, file));
    }
  }
  return map;
}

async function fetchDbTables(url, serviceKey) {
  // Use PostgREST OpenAPI: GET /rest/v1/ → JSON describing all tables.
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!r.ok) throw new Error(`Supabase REST ${r.status}: ${await r.text()}`);
  const spec = await r.json();
  return new Set(Object.keys(spec.definitions || {}));
}

function loadDeprecated() {
  const file = path.resolve(SRC_ROOT, "lib/db/canonical-tables.ts");
  const content = readFileSync(file, "utf8");
  // Anchor to `export const DEPRECATED_TABLES` to skip top-of-file documentation
  // comments that mention the symbol name.
  const block = /export\s+const\s+DEPRECATED_TABLES[^=]*=\s*\{([^}]+)\}/.exec(content);
  if (!block) return {};
  const out = {};
  // Only match real entries: key (optionally quoted) + colon + double-quoted value.
  const lineRe = /^\s*["']?([a-z_][a-z0-9_]*)["']?\s*:\s*"([a-z_][a-z0-9_]*)"/gim;
  let m;
  while ((m = lineRe.exec(block[1])) !== null) out[m[1]] = m[2];
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const offline = process.argv.includes("--offline") || !url || !key;

  console.log(`Auditing tables (root: ${path.relative(process.cwd(), SRC_ROOT)})${offline ? " [offline]" : ""}`);
  const codeMap = scanCodeTables();
  const deprecated = loadDeprecated();

  const codeTables = [...codeMap.keys()].sort();
  console.log(`\n• Tables referenced in code: ${codeTables.length}`);

  // Always check deprecated references — no DB needed.
  const depViolations = codeTables.filter((t) => deprecated[t]);
  if (depViolations.length > 0) {
    console.log("\n[FAIL] Deprecated table references:");
    for (const t of depViolations) {
      console.log(`  - '${t}' → use '${deprecated[t]}' instead`);
      for (const f of codeMap.get(t)) console.log(`      • ${f}`);
    }
  } else {
    console.log("\n[PASS] No deprecated references.");
  }

  if (!offline) {
    const dbTables = await fetchDbTables(url, key);
    console.log(`• Tables in Supabase DB:    ${dbTables.size}`);

    const missingInDb = codeTables.filter((t) => !dbTables.has(t));
    if (missingInDb.length > 0) {
      console.log("\n[FAIL] Code references tables that don't exist in DB:");
      for (const t of missingInDb) {
        console.log(`  - '${t}'`);
        for (const f of codeMap.get(t)) console.log(`      • ${f}`);
      }
    } else {
      console.log("\n[PASS] Every code-referenced table exists in DB.");
    }

    const orphans = [...dbTables].filter((t) => !codeMap.has(t)).sort();
    if (orphans.length > 0) {
      console.log(`\n[INFO] ${orphans.length} DB table(s) never referenced in code:`);
      for (const t of orphans) console.log(`  - ${t}`);
    }

    const exitCode = depViolations.length === 0 && missingInDb.length === 0 ? 0 : 1;
    process.exit(exitCode);
  }

  process.exit(depViolations.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(2);
});
