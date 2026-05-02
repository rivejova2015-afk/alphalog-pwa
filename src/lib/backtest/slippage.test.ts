import { describe, expect, it } from 'vitest';
import { applySlippage, computeSlippage } from './slippage';
import type { Bar } from '@/types/backtest';

const bar: Bar = {
  ts: '2026-01-01T00:00:00Z', open: 100, high: 102, low: 99, close: 101, volume: 1_000,
};

describe('slippage', () => {
  it('fixed mode returns fixedPoints', () => {
    expect(computeSlippage(bar, 'long', 1, { mode: 'fixed', fixedPoints: 0.5 })).toBe(0.5);
  });

  it('vwap mode scales with size and bar range', () => {
    const small = computeSlippage(bar, 'long', 1, { mode: 'vwap', participation: 0.05 });
    const big = computeSlippage(bar, 'long', 5, { mode: 'vwap', participation: 0.05 });
    expect(big).toBeGreaterThan(small);
  });

  it('almgren produces non-negative cost that grows with size', () => {
    const a = computeSlippage(bar, 'long', 1, { mode: 'almgren' });
    const b = computeSlippage(bar, 'long', 10, { mode: 'almgren' });
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
  });

  it('applySlippage shifts price up for long, down for short', () => {
    const longPx = applySlippage(100, bar, 'long', 1, { mode: 'fixed', fixedPoints: 0.2 });
    const shortPx = applySlippage(100, bar, 'short', 1, { mode: 'fixed', fixedPoints: 0.2 });
    expect(longPx).toBeCloseTo(100.2);
    expect(shortPx).toBeCloseTo(99.8);
  });
});
