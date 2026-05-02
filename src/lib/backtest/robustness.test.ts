import { describe, expect, it } from 'vitest';
import { computeRobustness, deflatedSharpe, probabilityOfBacktestOverfitting } from './robustness';
import type { SimulatedTrade } from '@/types/backtest';

function trade(pnlPct: number): SimulatedTrade {
  return {
    id: 1, side: 'long', entryTs: '', entryPrice: 0, exitTs: '', exitPrice: 0,
    lots: 0.1, slPrice: null, tpPrice: null, pnl: 0, pnlPct, bars: 1, exitReason: 'tp',
  };
}

describe('robustness', () => {
  it('deflatedSharpe returns 0 for too-few samples', () => {
    expect(deflatedSharpe([0.01, 0.02], 1.5, 10)).toBe(0);
  });

  it('deflatedSharpe yields a probability in [0, 1]', () => {
    const rets = Array.from({ length: 100 }, () => (Math.random() - 0.5) * 0.02);
    const dsr = deflatedSharpe(rets, 1.0, 20);
    expect(dsr).toBeGreaterThanOrEqual(0);
    expect(dsr).toBeLessThanOrEqual(1);
  });

  it('probabilityOfBacktestOverfitting returns 0 when matrix too small', () => {
    expect(probabilityOfBacktestOverfitting([[0.1, 0.2]])).toBe(0);
  });

  it('computeRobustness produces a complete stats object', () => {
    const trades = Array.from({ length: 50 }, (_, i) => trade((i % 3 === 0 ? 0.01 : -0.005)));
    const stats = computeRobustness(trades, 5);
    expect(stats.trialsTested).toBe(5);
    expect(typeof stats.deflatedSharpe).toBe('number');
    expect(typeof stats.skew).toBe('number');
    expect(typeof stats.kurtosis).toBe('number');
    expect(stats.whitePvalue).toBe(1);
    expect(stats.pbo).toBe(0);
  });
});
