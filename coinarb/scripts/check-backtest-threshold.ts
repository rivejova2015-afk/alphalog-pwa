#!/usr/bin/env tsx
/**
 * check-backtest-threshold — CI quality gate for the Coinarb backtest.
 *
 * Reads a JSON summary from stdin (or from --file=path) emitted by
 * `scripts/backtest.ts --json`. Asserts thresholds and exits 1 on
 * any failure so CI fails the deploy.
 *
 * Thresholds are intentionally LAX to start (we have no historical
 * baseline yet). Tighten as data accumulates.
 *
 *   --min-win-rate=0.30   (default 0.30 = 30%)
 *   --min-total-pnl-r=0   (default 0R; allow break-even)
 *   --min-entries=3       (default 3; require minimum sample size)
 *   --max-worst-run=8     (default 8; reject if any symbol had >8 losses in a row)
 *
 * Override path:
 *   --file=/tmp/backtest.json
 *
 * Skip gate (emergency):
 *   echo "[skip-backtest]" in commit message — handled in workflow yaml.
 *
 * Usage in CI:
 *   tsx scripts/backtest.ts --days=7 --json > /tmp/result.txt
 *   tsx scripts/check-backtest-threshold.ts --file=/tmp/result.txt
 */

import fs from 'node:fs';

interface ReplaySummary {
  mode: 'replay';
  windowDays: number;
  mtfConfidenceMin: number;
  rrMin: number;
  aggregate: { totalEntries: number; totalPnlR: number; winRate: number };
  symbols: Array<{
    symbol: string;
    entries: number;
    winRate: number;
    totalPnlR: number;
    bestRun: number;
    worstRun: number;
    blockedBy: Record<string, number>;
  }>;
}

interface SnapshotSummary {
  mode: 'snapshot';
  mtfConfidenceMin: number;
  wouldEnter: number;
  total: number;
  blockedBy: Record<string, number>;
  symbols: Array<{ symbol: string; wouldEnter: boolean; blockedAt: string | null }>;
}

type Summary = ReplaySummary | SnapshotSummary;

function parseArg(name: string, fallback: number): number {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const v = Number(arg.split('=')[1]);
  return Number.isFinite(v) ? v : fallback;
}

function getFlag(name: string): string | null {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] ?? null : null;
}

async function readPayload(): Promise<string> {
  const file = getFlag('file');
  if (file) return fs.readFileSync(file, 'utf-8');
  // Read from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function extractJson(raw: string): Summary {
  // The backtest script emits "--- JSON ---\n{...}" after human-readable logs.
  const marker = '--- JSON ---';
  const idx = raw.lastIndexOf(marker);
  const payload = idx >= 0 ? raw.slice(idx + marker.length).trim() : raw.trim();
  return JSON.parse(payload) as Summary;
}

const MIN_WIN_RATE   = parseArg('min-win-rate',   0.30);
const MIN_TOTAL_PNLR = parseArg('min-total-pnl-r', 0);
const MIN_ENTRIES    = parseArg('min-entries',    3);
const MAX_WORST_RUN  = parseArg('max-worst-run',  8);

async function main(): Promise<void> {
  const raw = await readPayload();
  let summary: Summary;
  try {
    summary = extractJson(raw);
  } catch (err) {
    console.error('[check-backtest-threshold] could not parse JSON:', err);
    process.exit(2);
  }

  console.log(`[check-backtest-threshold] mode=${summary.mode}`);
  const failures: string[] = [];

  if (summary.mode === 'replay') {
    const { aggregate, symbols, windowDays } = summary;
    console.log(`  windowDays=${windowDays} entries=${aggregate.totalEntries} winRate=${(aggregate.winRate * 100).toFixed(1)}% pnlR=${aggregate.totalPnlR.toFixed(2)}`);

    if (aggregate.totalEntries < MIN_ENTRIES) {
      failures.push(`aggregate entries ${aggregate.totalEntries} < min ${MIN_ENTRIES}`);
    }
    // winRate and pnlR are only meaningful when the strategy actually opened
    // positions — 0/0 collapses to 0% which fails any positive MIN_WIN_RATE
    // by construction. Skip those checks on zero-entry runs and rely on the
    // MIN_ENTRIES floor to decide whether the absence of entries is itself
    // a failure for this deploy.
    if (aggregate.totalEntries > 0) {
      if (aggregate.winRate < MIN_WIN_RATE) {
        failures.push(`aggregate winRate ${(aggregate.winRate * 100).toFixed(1)}% < min ${(MIN_WIN_RATE * 100).toFixed(0)}%`);
      }
      if (aggregate.totalPnlR < MIN_TOTAL_PNLR) {
        failures.push(`aggregate totalPnlR ${aggregate.totalPnlR.toFixed(2)} < min ${MIN_TOTAL_PNLR}`);
      }
    }
    for (const s of symbols) {
      if (s.worstRun > MAX_WORST_RUN) {
        failures.push(`${s.symbol} worstRun ${s.worstRun} > max ${MAX_WORST_RUN}`);
      }
    }
  } else {
    // Snapshot mode is informational. No fail-on-zero (the snapshot is a
    // one-tick verdict so 0 entries means "right this second", not "broken").
    console.log(`  wouldEnter=${summary.wouldEnter}/${summary.total}`);
    console.log(`  blockedBy=${JSON.stringify(summary.blockedBy)}`);
  }

  if (failures.length > 0) {
    console.error('\n[check-backtest-threshold] QUALITY GATE FAILED:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log('\n[check-backtest-threshold] OK');
}

main().catch(err => {
  console.error('[check-backtest-threshold] fatal:', err);
  process.exit(2);
});
