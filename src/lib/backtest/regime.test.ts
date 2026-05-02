import { describe, expect, it } from 'vitest';
import { classifyRegimes, regimePerformance } from './regime';
import type { Bar } from '@/types/backtest';

function makeBars(closes: number[]): Bar[] {
  return closes.map((c, i) => ({
    ts: new Date(2026, 0, 1, 0, i).toISOString(),
    open: c, high: c * 1.001, low: c * 0.999, close: c, volume: 1000,
  }));
}

describe('regime', () => {
  it('returns empty array when bars < lookback', () => {
    const bars = makeBars(Array.from({ length: 10 }, (_, i) => 100 + i));
    expect(classifyRegimes(bars, 30)).toEqual([]);
  });

  it('classifies steady uptrend as trend_up', () => {
    const bars = makeBars(Array.from({ length: 100 }, (_, i) => 100 * (1 + i * 0.005)));
    const regs = classifyRegimes(bars, 30);
    const lastHalf = regs.slice(50);
    const upCount = lastHalf.filter((r) => r.regime === 'trend_up').length;
    expect(upCount).toBeGreaterThan(lastHalf.length * 0.5);
  });

  it('classifies steady downtrend as trend_down', () => {
    const bars = makeBars(Array.from({ length: 100 }, (_, i) => 100 * (1 - i * 0.005)));
    const regs = classifyRegimes(bars, 30);
    const lastHalf = regs.slice(50);
    const downCount = lastHalf.filter((r) => r.regime === 'trend_down').length;
    expect(downCount).toBeGreaterThan(lastHalf.length * 0.5);
  });

  it('regimePerformance aggregates trades by entry regime', () => {
    const bars = makeBars(Array.from({ length: 100 }, (_, i) => 100 + i));
    const regs = classifyRegimes(bars, 30);
    const trades = [
      { entryTs: regs[40].ts, exitTs: regs[50].ts, pnl: 10 },
      { entryTs: regs[60].ts, exitTs: regs[70].ts, pnl: -5 },
    ];
    const perf = regimePerformance(regs, trades);
    const total = perf.reduce((s, r) => s + r.trades, 0);
    expect(total).toBe(2);
    expect(perf.reduce((s, r) => s + r.pnl, 0)).toBe(5);
  });
});
