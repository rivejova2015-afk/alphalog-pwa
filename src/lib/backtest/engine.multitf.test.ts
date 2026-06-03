// Integration test for Gap #4 — verifies that runBacktest honors the
// useMultiTf flag end-to-end: builds a bias cache from cfg.multiTfBars,
// blocks contradictory entries in the hot loop, increments
// tradesFilteredCount, and attaches multiTfStats to the result.

import { describe, it, expect } from 'vitest';
import { runBacktest } from './engine';
import type { Bar, BacktestConfig } from '@/types/backtest';

function makeBars(closes: number[], startMs = Date.UTC(2026, 0, 1), stepMs = 60_000 * 15): Bar[] {
  return closes.map((c, i) => ({
    ts: new Date(startMs + i * stepMs).toISOString(),
    open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 1000,
  }));
}

// Primary-TF: oscillating price (sin wave) so RSI swings across thresholds
// and the entry rule fires repeatedly.
function oscillating(n: number): Bar[] {
  const closes = Array.from({ length: n }, (_, i) => 100 + Math.sin(i / 4) * 5);
  return makeBars(closes);
}

function baseCfg(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol: 'XAUUSD',
    timeframe: 'M15',
    from: '2026-01-01T00:00:00Z',
    to:   '2026-02-01T00:00:00Z',
    initialBalance: 10_000,
    contractSize: 100,
    pointValue: 1,
    spreadPoints: 0,
    commissionPerLot: 0,
    slippagePoints: 0,
    direction: 'both',
    parameters: {},
    rules: {
      entryLong:  [{ left: { type: 'rsi', period: 14 }, op: '<', right: 35 }],
      entryShort: [{ left: { type: 'rsi', period: 14 }, op: '>', right: 65 }],
      exitLong:   [{ left: { type: 'rsi', period: 14 }, op: '>', right: 50 }],
      exitShort:  [{ left: { type: 'rsi', period: 14 }, op: '<', right: 50 }],
      slPoints: 100,
      tpPoints: 200,
      sizing: { mode: 'fixed_lot', value: 0.1 },
      maxConcurrent: 1,
    } as unknown as BacktestConfig['rules'],
    ...overrides,
  };
}

describe('runBacktest — multi-TF filter integration (Gap #4)', () => {
  it('baseline (no useMultiTf) → multiTfStats undefined, all entries pass', async () => {
    const bars = oscillating(300);
    const result = await runBacktest(bars, baseCfg());
    expect(result.multiTfStats).toBeUndefined();
    expect(result.trades.length).toBeGreaterThan(0);
  });

  it('useMultiTf with bearish higher TF → blocks longs, tradesFilteredCount > 0', async () => {
    // Higher TF starts 200h BEFORE the primary so the EMA50 is fully
    // established when the filter starts querying.
    const HIGHER_PREROLL_MS = 60 * 60 * 1000 * 200; // 200h preroll
    const primaryStart = Date.UTC(2026, 0, 10);
    const bars = makeBars(
      Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 4) * 5),
      primaryStart,
    );
    // Higher TF: monotonic downtrend that starts well before the primary.
    const bearHigher = makeBars(
      Array.from({ length: 150 }, (_, i) => 200 - i),
      primaryStart - HIGHER_PREROLL_MS,
      60 * 60 * 1000 * 4,
    );
    const cfg = baseCfg({
      useMultiTf: true,
      multiTfBars: new Map([['H4', bearHigher]]),
    });
    const baseline = await runBacktest(bars, baseCfg());
    const filtered = await runBacktest(bars, cfg);
    expect(filtered.multiTfStats).toBeDefined();
    expect(filtered.multiTfStats!.tradesFilteredCount).toBeGreaterThan(0);
    expect(filtered.trades.length).toBeLessThanOrEqual(baseline.trades.length);
  });

  it('useMultiTf with bullish higher TF aligned with longs → no longs filtered', async () => {
    const HIGHER_PREROLL_MS = 60 * 60 * 1000 * 200;
    const primaryStart = Date.UTC(2026, 0, 10);
    const bars = makeBars(
      Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 4) * 5),
      primaryStart,
    );
    const bullHigher = makeBars(
      Array.from({ length: 150 }, (_, i) => 100 + i),
      primaryStart - HIGHER_PREROLL_MS,
      60 * 60 * 1000 * 4,
    );
    const cfg = baseCfg({
      direction: 'long',
      useMultiTf: true,
      multiTfBars: new Map([['H4', bullHigher]]),
    });
    const result = await runBacktest(bars, cfg);
    expect(result.multiTfStats).toBeDefined();
    expect(result.multiTfStats!.tradesFilteredCount).toBe(0);
  });

  it('alignment summary reports per-TF bull/bear/neutral counts', async () => {
    const HIGHER_PREROLL_MS = 60 * 60 * 1000 * 200;
    const primaryStart = Date.UTC(2026, 0, 10);
    const bars = makeBars(
      Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 4) * 5),
      primaryStart,
    );
    const bearHigher = makeBars(
      Array.from({ length: 150 }, (_, i) => 200 - i),
      primaryStart - HIGHER_PREROLL_MS,
      60 * 60 * 1000 * 4,
    );
    const cfg = baseCfg({
      useMultiTf: true,
      multiTfBars: new Map([['H4', bearHigher]]),
    });
    const result = await runBacktest(bars, cfg);
    expect(result.multiTfStats!.alignment.byTf.H4).toBeDefined();
    const dist = result.multiTfStats!.alignment.byTf.H4;
    expect(dist.bear).toBeGreaterThan(0);
    expect(dist.bull).toBe(0);
    expect(result.multiTfStats!.alignment.totalPrimaryBars).toBe(200);
  });

  it('useMultiTf=true but cfg.multiTfBars empty → stats undefined (filter no-op)', async () => {
    const bars = oscillating(200);
    const cfg = baseCfg({
      useMultiTf: true,
      multiTfBars: new Map(), // hydration failed → empty
    });
    const result = await runBacktest(bars, cfg);
    expect(result.multiTfStats).toBeUndefined();
  });
});
