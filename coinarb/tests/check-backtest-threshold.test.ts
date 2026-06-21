/**
 * Unit tests for the CI quality-gate parser/assertions.
 *
 * The script itself is an executable (process.exit + stdin reads), so we
 * extract the pure parsing/extraction helpers via dynamic import + module
 * surface inspection where possible. For the gate logic, we test via
 * spawn-style invocation with --file=.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve(__dirname, '../scripts/check-backtest-threshold.ts');

function writeFixture(name: string, body: unknown): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coinarb-gate-'));
  const fp = path.join(tmp, name);
  fs.writeFileSync(fp, '--- JSON ---\n' + JSON.stringify(body) + '\n');
  return fp;
}

function run(file: string, extraArgs: string[] = []): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execSync(`npx tsx ${SCRIPT_PATH} --file=${file} ${extraArgs.join(' ')}`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (e: unknown) {
    // execSync throws when exit code != 0; grab status/output from the error.
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const replaySummary = (overrides: Record<string, unknown> = {}) => ({
  mode: 'replay',
  windowDays: 7,
  mtfConfidenceMin: 0.15,
  rrMin: 2,
  aggregate: { totalEntries: 10, totalPnlR: 4.0, winRate: 0.55, ...((overrides.aggregate as object) ?? {}) },
  symbols: (overrides.symbols as unknown[]) ?? [
    { symbol: 'BTC-USD', entries: 4, winRate: 0.5, totalPnlR: 1.0, bestRun: 2, worstRun: 2, blockedBy: {} },
    { symbol: 'ETH-USD', entries: 3, winRate: 0.66, totalPnlR: 2.0, bestRun: 2, worstRun: 1, blockedBy: {} },
    { symbol: 'SOL-USD', entries: 3, winRate: 0.50, totalPnlR: 1.0, bestRun: 1, worstRun: 1, blockedBy: {} },
  ],
});

describe('check-backtest-threshold — replay mode', () => {
  let cleanup: string[] = [];
  afterEach(() => {
    for (const fp of cleanup) fs.rmSync(path.dirname(fp), { recursive: true, force: true });
    cleanup = [];
  });

  it('exits 0 when all thresholds pass with defaults', () => {
    const fp = writeFixture('ok.json', replaySummary());
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('OK');
  });

  it('exits 1 when win rate < default 30%', () => {
    const fp = writeFixture('low-wr.json', replaySummary({ aggregate: { totalEntries: 10, totalPnlR: 2.0, winRate: 0.20 } }));
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/winRate.*< min/);
  });

  it('exits 1 when total PnL R < default 0', () => {
    const fp = writeFixture('neg-pnl.json', replaySummary({ aggregate: { totalEntries: 10, totalPnlR: -2.5, winRate: 0.55 } }));
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/totalPnlR.*< min/);
  });

  it('exits 1 when entries < default 3', () => {
    const fp = writeFixture('few.json', replaySummary({ aggregate: { totalEntries: 1, totalPnlR: 2.0, winRate: 1.0 } }));
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/entries.*< min/);
  });

  it('exits 1 when any symbol has worstRun > default 8', () => {
    const fp = writeFixture('bad-streak.json', replaySummary({
      symbols: [
        { symbol: 'BTC-USD', entries: 4, winRate: 0.5, totalPnlR: 1.0, bestRun: 2, worstRun: 9, blockedBy: {} },
        { symbol: 'ETH-USD', entries: 3, winRate: 0.66, totalPnlR: 2.0, bestRun: 2, worstRun: 1, blockedBy: {} },
        { symbol: 'SOL-USD', entries: 3, winRate: 0.50, totalPnlR: 1.0, bestRun: 1, worstRun: 1, blockedBy: {} },
      ],
    }));
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/BTC-USD worstRun 9/);
  });

  it('respects --min-win-rate override', () => {
    // Default 0.30 passes, but custom 0.80 should fail.
    const fp = writeFixture('strict-wr.json', replaySummary());
    cleanup.push(fp);
    const result = run(fp, ['--min-win-rate=0.80']);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/winRate.*< min 80/);
  });

  it('respects --min-entries=0 (allow zero-entry replays)', () => {
    const fp = writeFixture('zero.json', replaySummary({ aggregate: { totalEntries: 0, totalPnlR: 0, winRate: 0 } }));
    cleanup.push(fp);
    const result = run(fp, ['--min-entries=0', '--min-win-rate=0']);
    expect(result.code).toBe(0);
  });

  it('does NOT fail on winRate/pnlR when entries=0 even with default 30% floor', () => {
    // Regression for the Phase 2 deploy block: SMC strict replays 0 entries in
    // chop regimes, collapsing winRate to 0/0 = 0%. With --min-entries=0 the
    // 0% winRate and 0 pnlR must NOT trip the default thresholds — those
    // metrics are meaningless on an empty sample.
    const fp = writeFixture('zero-default-wr.json', replaySummary({ aggregate: { totalEntries: 0, totalPnlR: 0, winRate: 0 } }));
    cleanup.push(fp);
    const result = run(fp, ['--min-entries=0']); // default --min-win-rate=0.30, --min-total-pnl-r=0
    expect(result.code).toBe(0);
  });

  it('still enforces winRate/pnlR when entries > 0 (guard not bypassed globally)', () => {
    // The entries=0 escape hatch must not weaken the gate when entries exist.
    const fp = writeFixture('some-entries-low-wr.json', replaySummary({ aggregate: { totalEntries: 5, totalPnlR: 1.0, winRate: 0.10 } }));
    cleanup.push(fp);
    const result = run(fp, ['--min-entries=0']);
    expect(result.code).toBe(1);
  });
});

describe('check-backtest-threshold — snapshot mode (informational)', () => {
  let cleanup: string[] = [];
  afterEach(() => {
    for (const fp of cleanup) fs.rmSync(path.dirname(fp), { recursive: true, force: true });
    cleanup = [];
  });

  it('exits 0 even when wouldEnter=0 (snapshot is single-tick)', () => {
    const fp = writeFixture('snap.json', {
      mode: 'snapshot',
      mtfConfidenceMin: 0.15,
      wouldEnter: 0,
      total: 3,
      blockedBy: { 'liquidity-sweep': 3 },
      symbols: [
        { symbol: 'BTC-USD', wouldEnter: false, blockedAt: 'liquidity-sweep' },
        { symbol: 'ETH-USD', wouldEnter: false, blockedAt: 'liquidity-sweep' },
        { symbol: 'SOL-USD', wouldEnter: false, blockedAt: 'liquidity-sweep' },
      ],
    });
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('wouldEnter=0/3');
  });
});

describe('check-backtest-threshold — input handling', () => {
  let cleanup: string[] = [];
  afterEach(() => {
    for (const fp of cleanup) fs.rmSync(path.dirname(fp), { recursive: true, force: true });
    cleanup = [];
  });

  it('exits 2 on unparseable JSON', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coinarb-gate-'));
    const fp = path.join(tmp, 'broken.json');
    fs.writeFileSync(fp, 'not json at all');
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/could not parse JSON/);
  });

  it('strips human-readable logs before the --- JSON --- marker', () => {
    // The fixture writer already prepends the marker; this confirms the
    // extractor ignores anything before it.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coinarb-gate-'));
    const fp = path.join(tmp, 'mixed.json');
    fs.writeFileSync(fp, 'random console.log noise\nmore noise\n--- JSON ---\n' + JSON.stringify(replaySummary()) + '\n');
    cleanup.push(fp);
    const result = run(fp);
    expect(result.code).toBe(0);
  });
});
