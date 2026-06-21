import { describe, it, expect } from 'vitest';
import { regimeReplay } from '../scripts/backtest-regime-aware.js';
import type { Candle } from '../src/analysis/candle-builder.js';

// Reuse the same candle fabrications as regime-detector.test.ts. Kept
// inline here so the test file is self-contained — regimeReplay is a
// thin wrapper over classifyRegime and we mostly verify aggregation, not
// the underlying classification math.

function candle(open: number, high: number, low: number, close: number, ts = 0): Candle {
  return {
    timeframe: '1H',
    openTs: ts,
    closeTs: ts + 3_600_000,
    open, high, low, close,
    volume: 0,
  };
}

function flatCandles(n: number, price = 100): Candle[] {
  return Array.from({ length: n }, (_, i) =>
    candle(price, price, price, price, i * 3_600_000),
  );
}

function constantRangeCandles(n: number, basePrice: number, range: number, delta = 0): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const open = basePrice + i * delta;
    const high = open + range / 2;
    const low = open - range / 2;
    const close = open + delta;
    return candle(open, high, low, close, i * 3_600_000);
  });
}

describe('regimeReplay', () => {
  it('returns zeros when input is shorter than baseline window', () => {
    const candles = flatCandles(150);
    const report = regimeReplay(candles, 7, 'BTC-USD');
    expect(report.totalHoursAnalyzed).toBe(0);
    expect(report.transitions).toBe(0);
    for (const regime of Object.keys(report.distribution)) {
      const stat = report.distribution[regime as keyof typeof report.distribution];
      expect(stat.hoursInRegime).toBe(0);
      expect(stat.pct).toBe(0);
    }
  });

  it('classifies a fully flat 400-candle series mostly as DEAD', () => {
    const candles = flatCandles(400);
    const report = regimeReplay(candles, 14, 'BTC-USD');
    expect(report.totalHoursAnalyzed).toBeGreaterThan(150);
    // Vast majority should be DEAD because vol is zero — atrNorm collapses.
    expect(report.distribution.DEAD.hoursInRegime).toBeGreaterThan(
      report.totalHoursAnalyzed * 0.8,
    );
  });

  it('reports symbol and window through unchanged', () => {
    const report = regimeReplay(flatCandles(400), 14, 'ETH-USD');
    expect(report.symbol).toBe('ETH-USD');
    expect(report.windowDays).toBe(14);
  });

  it('counts transitions correctly across regime changes', () => {
    // Flat baseline (atrNorm=0 → DEAD) followed by an active range. The
    // classifier should detect the moment the second segment lifts vol
    // above the median. A subtler vol-up-vol transition won't show because
    // the rolling median absorbs the change; the flat→active boundary is a
    // clear regime switch.
    const flat = flatCandles(220);
    const active = constantRangeCandles(220, 100, 3).map((c, i) => ({
      ...c,
      openTs: (220 + i) * 3_600_000,
      closeTs: (221 + i) * 3_600_000,
    }));
    const report = regimeReplay([...flat, ...active], 21, 'BTC-USD');
    expect(report.totalHoursAnalyzed).toBeGreaterThan(150);
    expect(report.transitions).toBeGreaterThan(0);
  });

  it('distribution percentages sum to ~1.0 when hours analyzed > 0', () => {
    const report = regimeReplay(constantRangeCandles(400, 100, 2), 14, 'BTC-USD');
    if (report.totalHoursAnalyzed === 0) return; // baseline insufficient case
    const total = Object.values(report.distribution).reduce((acc, stat) => acc + stat.pct, 0);
    expect(total).toBeGreaterThan(0.99);
    expect(total).toBeLessThan(1.01);
  });

  it('exposes per-regime avg confidence / atrNorm / adx for non-empty buckets', () => {
    const report = regimeReplay(constantRangeCandles(400, 100, 2), 14, 'BTC-USD');
    for (const regime of Object.keys(report.distribution)) {
      const stat = report.distribution[regime as keyof typeof report.distribution];
      if (stat.hoursInRegime > 0) {
        // All three stats must be finite numbers; confidence in [0,1].
        expect(Number.isFinite(stat.avgConfidence)).toBe(true);
        expect(Number.isFinite(stat.avgAtrNorm)).toBe(true);
        expect(Number.isFinite(stat.avgAdx)).toBe(true);
        expect(stat.avgConfidence).toBeGreaterThanOrEqual(0);
        expect(stat.avgConfidence).toBeLessThanOrEqual(1);
      }
    }
  });
});
