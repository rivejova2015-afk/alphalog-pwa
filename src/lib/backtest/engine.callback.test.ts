// Verifies the new RunBacktestOptions hook for streaming progress:
//   - Backward compat: calling without opts produces identical results.
//   - Bit-exact parity: passing onProgress doesn't perturb trades/equity/metrics.
//   - Delta semantics: each callback receives only newEquity/newTrades since
//     the previous call — not the full arrays.
//   - Cadence: progressEveryNBars controls how often the callback fires.

import { describe, it, expect, vi } from 'vitest';
import { runBacktest, type BacktestProgressSnapshot } from './engine';
import type { Bar, BacktestConfig } from '@/types/backtest';

function makeBars(closes: number[], startMs = Date.UTC(2026, 0, 1), stepMs = 60_000 * 15): Bar[] {
  return closes.map((c, i) => ({
    ts: new Date(startMs + i * stepMs).toISOString(),
    open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 1000,
  }));
}

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

describe('runBacktest — RunBacktestOptions callback hook', () => {
  it('backward compat: no opts arg → result identical to opts: undefined', async () => {
    const bars = oscillating(300);
    const noOpts = await runBacktest(bars, baseCfg());
    const undefinedOpts = await runBacktest(bars, baseCfg(), undefined);
    expect(undefinedOpts.trades.length).toBe(noOpts.trades.length);
    expect(undefinedOpts.equityCurve.length).toBe(noOpts.equityCurve.length);
    expect(undefinedOpts.finalBalance).toBe(noOpts.finalBalance);
    expect(undefinedOpts.metrics).toEqual(noOpts.metrics);
  });

  it('parity: result with onProgress is bit-identical to result without', async () => {
    const bars = oscillating(500);
    const baseline = await runBacktest(bars, baseCfg());
    const callback = vi.fn();
    const withCallback = await runBacktest(bars, baseCfg(), {
      onProgress: callback,
      progressEveryNBars: 25,
    });

    expect(withCallback.trades).toEqual(baseline.trades);
    expect(withCallback.equityCurve).toEqual(baseline.equityCurve);
    expect(withCallback.finalBalance).toBe(baseline.finalBalance);
    expect(withCallback.metrics).toEqual(baseline.metrics);
    expect(withCallback.multiTfStats).toEqual(baseline.multiTfStats);

    // Should have been called at least once (500 bars / 25 every = ~20 times).
    expect(callback).toHaveBeenCalled();
  });

  it('delta semantics: deltas concatenate to the final arrays', async () => {
    const bars = oscillating(500);
    const seenEquity: BacktestProgressSnapshot['newEquity'] = [];
    const seenTrades: BacktestProgressSnapshot['newTrades'] = [];

    const result = await runBacktest(bars, baseCfg(), {
      progressEveryNBars: 30,
      onProgress: (snap) => {
        seenEquity.push(...snap.newEquity);
        seenTrades.push(...snap.newTrades);
      },
    });

    // The streamed deltas should cover everything pushed during the loop. The
    // engine also closes any open positions and appends a final equity point
    // *after* the loop (eod), so the streamed totals may be slightly less than
    // the final arrays. We assert "at least the in-loop part is streamed".
    expect(seenEquity.length).toBeGreaterThan(0);
    expect(seenEquity.length).toBeLessThanOrEqual(result.equityCurve.length);
    // Every streamed equity point must match the final array at the same idx.
    seenEquity.forEach((ep, i) => {
      expect(ep).toEqual(result.equityCurve[i]);
    });
    // Same invariant for trades streamed during the loop (trades closed inside
    // the for; eod-closed trades only land at the end).
    seenTrades.forEach((t, i) => {
      expect(t).toEqual(result.trades[i]);
    });
  });

  it('progressEveryNBars=1 fires almost every iteration', async () => {
    const bars = oscillating(120);
    const calls: number[] = [];
    await runBacktest(bars, baseCfg(), {
      progressEveryNBars: 1,
      onProgress: (snap) => { calls.push(snap.processedBars); },
    });
    // Loop runs i = 50..119 (70 iterations). With every=1, fires at every i
    // where i % 1 === 0 (always) → ~70 calls.
    expect(calls.length).toBeGreaterThan(60);
    // Calls should be monotonically increasing.
    for (let i = 1; i < calls.length; i++) expect(calls[i]).toBeGreaterThan(calls[i - 1]);
  });

  it('progressEveryNBars=50 fires sparsely', async () => {
    const bars = oscillating(300);
    const calls: number[] = [];
    await runBacktest(bars, baseCfg(), {
      progressEveryNBars: 50,
      onProgress: (snap) => { calls.push(snap.processedBars); },
    });
    // Loop runs i = 50..299. Callback fires when i % 50 === 0 → i ∈ {50,100,150,200,250} → 5 calls.
    expect(calls.length).toBeGreaterThanOrEqual(4);
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it('async callback is awaited (back-pressure)', async () => {
    const bars = oscillating(200);
    let fired = 0;
    let completedAwaits = 0;
    await runBacktest(bars, baseCfg(), {
      progressEveryNBars: 25,
      onProgress: async () => {
        fired++;
        await new Promise((r) => setTimeout(r, 1));
        completedAwaits++;
      },
    });
    // If the callback were not awaited, completedAwaits could lag behind
    // fired when the test process exits. They must be equal.
    expect(completedAwaits).toBe(fired);
    expect(fired).toBeGreaterThan(0);
  });

  it('snapshot reports correct totalBars and increasing processedBars', async () => {
    const bars = oscillating(400);
    const snapshots: BacktestProgressSnapshot[] = [];
    await runBacktest(bars, baseCfg(), {
      progressEveryNBars: 60,
      onProgress: (snap) => { snapshots.push(snap); },
    });
    expect(snapshots.length).toBeGreaterThan(0);
    snapshots.forEach((s) => expect(s.totalBars).toBe(400));
    for (let i = 1; i < snapshots.length; i++) {
      expect(snapshots[i].processedBars).toBeGreaterThan(snapshots[i - 1].processedBars);
    }
  });
});
