import { describe, it, expect } from 'vitest';
import {
  computeBiasSeries,
  findIndexAtOrBefore,
  multiTfBlocks,
  summarizeAlignment,
  buildBiasCache,
} from './multi-tf-filter';
import type { Bar } from '@/types/backtest';

function makeBars(closes: number[], startMs = Date.UTC(2026, 0, 1)): Bar[] {
  return closes.map((c, i) => ({
    ts: new Date(startMs + i * 60_000 * 60).toISOString(), // 1h spacing
    open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 1000,
  }));
}

describe('multi-tf-filter — computeBiasSeries', () => {
  it('empty bars → empty bias', () => {
    expect(computeBiasSeries([])).toEqual([]);
  });

  it('rising series → trailing bars are bull (+1)', () => {
    const bars = makeBars(Array.from({ length: 60 }, (_, i) => 100 + i));
    const bias = computeBiasSeries(bars, 10);
    // First (period-1) bars are NaN → 0. Subsequent bars on a strict uptrend
    // sit above EMA → +1.
    expect(bias.slice(0, 9).every((b) => b === 0)).toBe(true);
    expect(bias.slice(15).every((b) => b === 1)).toBe(true);
  });

  it('falling series → trailing bars are bear (-1)', () => {
    const bars = makeBars(Array.from({ length: 60 }, (_, i) => 200 - i));
    const bias = computeBiasSeries(bars, 10);
    expect(bias.slice(15).every((b) => b === -1)).toBe(true);
  });
});

describe('multi-tf-filter — findIndexAtOrBefore', () => {
  it('returns -1 when target predates the first bar', () => {
    const tsMs = [100, 200, 300];
    expect(findIndexAtOrBefore(tsMs, 50)).toBe(-1);
  });

  it('returns exact index on a hit', () => {
    const tsMs = [100, 200, 300];
    expect(findIndexAtOrBefore(tsMs, 200)).toBe(1);
  });

  it('returns the most recent bar with ts <= target', () => {
    const tsMs = [100, 200, 300];
    expect(findIndexAtOrBefore(tsMs, 250)).toBe(1);
    expect(findIndexAtOrBefore(tsMs, 999)).toBe(2);
  });

  it('empty array → -1', () => {
    expect(findIndexAtOrBefore([], 100)).toBe(-1);
  });
});

describe('multi-tf-filter — multiTfBlocks', () => {
  it('empty cache never blocks', () => {
    const cache = new Map();
    expect(multiTfBlocks('long',  '2026-01-01T00:00:00Z', cache)).toBe(false);
    expect(multiTfBlocks('short', '2026-01-01T00:00:00Z', cache)).toBe(false);
  });

  it('long entry + bullish TF → not blocked', () => {
    const bullBars = makeBars(Array.from({ length: 60 }, (_, i) => 100 + i));
    const cache = buildBiasCache(new Map([['H4', bullBars]]), 10);
    const ts = bullBars[55].ts;
    expect(multiTfBlocks('long', ts, cache)).toBe(false);
  });

  it('long entry + bearish TF → blocked', () => {
    const bearBars = makeBars(Array.from({ length: 60 }, (_, i) => 200 - i));
    const cache = buildBiasCache(new Map([['D1', bearBars]]), 10);
    const ts = bearBars[55].ts;
    expect(multiTfBlocks('long', ts, cache)).toBe(true);
  });

  it('short entry + bullish TF → blocked', () => {
    const bullBars = makeBars(Array.from({ length: 60 }, (_, i) => 100 + i));
    const cache = buildBiasCache(new Map([['H4', bullBars]]), 10);
    const ts = bullBars[55].ts;
    expect(multiTfBlocks('short', ts, cache)).toBe(true);
  });

  it('any single contradicting TF in a multi-TF cache blocks the entry', () => {
    const bullBars = makeBars(Array.from({ length: 60 }, (_, i) => 100 + i));
    const bearBars = makeBars(Array.from({ length: 60 }, (_, i) => 200 - i));
    const cache = buildBiasCache(new Map([['H4', bullBars], ['D1', bearBars]]), 10);
    const ts = bullBars[55].ts;
    // long: H4 bull (ok), D1 bear (contradicts) → blocked
    expect(multiTfBlocks('long', ts, cache)).toBe(true);
  });

  it('timestamp predating the higher-TF series → not blocked (no bar to compare)', () => {
    const bearBars = makeBars(Array.from({ length: 60 }, (_, i) => 200 - i), Date.UTC(2026, 5, 1));
    const cache = buildBiasCache(new Map([['D1', bearBars]]), 10);
    // long entry on 2025-12-31 — predates the D1 series → no block.
    expect(multiTfBlocks('long', '2025-12-31T00:00:00Z', cache)).toBe(false);
  });
});

describe('multi-tf-filter — summarizeAlignment', () => {
  it('tallies bull/bear/neutral counts per TF across primary bars', () => {
    const bullBars = makeBars(Array.from({ length: 60 }, (_, i) => 100 + i));
    const cache = buildBiasCache(new Map([['H4', bullBars]]), 10);
    const primary = bullBars.slice(20, 40); // 20 bars, all in the bull regime
    const summary = summarizeAlignment(primary, cache);
    expect(summary.totalPrimaryBars).toBe(20);
    expect(summary.byTf.H4.bull).toBe(20);
    expect(summary.byTf.H4.bear).toBe(0);
    expect(summary.byTf.H4.neutral).toBe(0);
  });

  it('bars predating the higher-TF series count as neutral', () => {
    const bearBars = makeBars(Array.from({ length: 60 }, (_, i) => 200 - i), Date.UTC(2026, 5, 1));
    const cache = buildBiasCache(new Map([['D1', bearBars]]), 10);
    const earlyPrimary = makeBars([100, 101, 102], Date.UTC(2025, 11, 1));
    const summary = summarizeAlignment(earlyPrimary, cache);
    expect(summary.byTf.D1.neutral).toBe(3);
  });
});
