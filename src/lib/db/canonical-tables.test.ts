// Anti-bug guard: scans the codebase for `.from('table')` calls and asserts
// no file references a deprecated table. This test catches the exact bug
// where the algorithms page silently read from `trading_algorithms` while
// the wizard wrote into `algorithms`.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DEPRECATED_TABLES } from "./canonical-tables";

const SRC_ROOT = path.resolve(__dirname, "../..");
const FROM_REGEX = /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)/gi;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

interface Hit { file: string; table: string }

function scan(): Hit[] {
  const hits: Hit[] = [];
  for (const file of walk(SRC_ROOT)) {
    const content = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    FROM_REGEX.lastIndex = 0;
    while ((m = FROM_REGEX.exec(content)) !== null) {
      hits.push({ file: path.relative(SRC_ROOT, file), table: m[1] });
    }
  }
  return hits;
}

// Files that legitimately use the legacy `trading_algorithms` schema today.
// Currently empty — the migration to the canonical `algorithms` table is
// complete. The Set is kept (rather than removed) so future legacy fixtures
// can be re-added without changing the test structure.
const LEGACY_TRADING_ALGORITHMS_FILES = new Set<string>([]);

function norm(p: string): string { return p.replace(/\\/g, "/"); }

describe("canonical tables (anti-bug guard)", () => {
  const hits = scan();

  it("algorithms feature: page, wizard, and crons all read/write the same table", () => {
    const ALGO_FILES = [
      "app/intelligence/algorithms/page.tsx",
      // NewStrategyWizard.client.tsx no longer writes to `algorithms` directly —
      // the alphalog-migration moved that insert server-side (raw-Postgres
      // client) into this route, which the wizard now calls via fetch().
      "app/api/bot-control/algorithms/route.ts",
      "app/api/cron/backtest/paper-bridge/route.ts",
      "app/api/cron/backtest/daemon/route.ts",
    ];
    for (const rel of ALGO_FILES) {
      const fileHits = hits.filter((h) => norm(h.file).endsWith(rel));
      const usesAlgorithms = fileHits.some((h) => h.table === "algorithms");
      const usesTradingAlgorithms = fileHits.some((h) => h.table === "trading_algorithms");
      expect(usesAlgorithms, `${rel} must reference \`algorithms\``).toBe(true);
      expect(usesTradingAlgorithms, `${rel} must NOT reference deprecated \`trading_algorithms\``).toBe(false);
    }
  });

  it("no NEW file references a deprecated table (allowlist baseline)", () => {
    const violations = hits.filter((h) => {
      if (!DEPRECATED_TABLES[h.table]) return false;
      return !LEGACY_TRADING_ALGORITHMS_FILES.has(norm(h.file));
    });
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${norm(v.file)}: uses '${v.table}' — should be '${DEPRECATED_TABLES[v.table]}'`)
        .join("\n");
      throw new Error(`New deprecated-table references detected:\n${msg}`);
    }
    expect(violations).toHaveLength(0);
  });
});
