import { describe, it, expect } from 'vitest';
import {
  sma,
  stdev,
  bollingerBands,
  rsi,
  atr,
  detectMeanRevSignal,
  DEFAULT_MEAN_REV_CONFIG,
} from '../src/strategies/mean-reversion.js';
import type { Candle } from '../src/analysis/candle-builder.js';

function candle(open: number, high: number, low: number, close: number, ts = 0): Candle {
  return {
    timeframe: '1H',
    openTs: ts,
    closeTs: ts + 3_600_000,
    open, high, low, close,
    volume: 0,
  };
}

/** Build n flat candles at a single price (TR = 0, RSI = 50, BB collapses). */
function flatCandles(n: number, price = 100): Candle[] {
  return Array.from({ length: n }, (_, i) =>
    candle(price, price, price, price, i * 3_600_000),
  );
}

/** Build candles whose closes follow an explicit price series. */
function candlesFromCloses(closes: number[]): Candle[] {
  return closes.map((c, i) => candle(c, c + 0.5, c - 0.5, c, i * 3_600_000));
}

// ============================================================================

describe('sma', () => {
  it('returns NaN when input is shorter than period', () => {
    expect(sma([1, 2, 3], 5)).toBeNaN();
  });

  it('averages the last `period` closes', () => {
    expect(sma([10, 20, 30, 40, 50], 3)).toBe(40);
  });

  it('is exact on a constant series', () => {
    expect(sma([42, 42, 42, 42], 4)).toBe(42);
  });
});

describe('stdev', () => {
  it('returns NaN when input is shorter than period', () => {
    expect(stdev([1, 2], 5)).toBeNaN();
  });

  it('is 0 on a constant series', () => {
    expect(stdev([10, 10, 10, 10], 4)).toBe(0);
  });

  it('is positive on a varied series', () => {
    expect(stdev([1, 2, 3, 4], 4)).toBeGreaterThan(0);
  });
});

describe('bollingerBands', () => {
  it('returns NaN bands when input is shorter than period', () => {
    const bb = bollingerBands([1, 2, 3], 20);
    expect(bb.middle).toBeNaN();
    expect(bb.upper).toBeNaN();
    expect(bb.lower).toBeNaN();
  });

  it('collapses to middle on a constant series (zero sigma)', () => {
    const bb = bollingerBands(new Array(25).fill(100), 20, 2);
    expect(bb.middle).toBe(100);
    expect(bb.upper).toBe(100);
    expect(bb.lower).toBe(100);
  });

  it('upper > middle > lower on a varied series', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i);
    const bb = bollingerBands(closes, 20, 2);
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
  });
});

describe('rsi', () => {
  it('returns NaN when input is shorter than period + 1', () => {
    expect(rsi([1, 2, 3], 14)).toBeNaN();
  });

  it('returns 50 on a constant series', () => {
    expect(rsi(new Array(20).fill(100), 14)).toBe(50);
  });

  it('approaches 100 on a strict monotonic uptrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBeGreaterThan(95);
  });

  it('approaches 0 on a strict monotonic downtrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 - i);
    expect(rsi(closes, 14)).toBeLessThan(5);
  });
});

describe('atr (mean-rev module copy)', () => {
  it('returns NaN when input is shorter than period + 1', () => {
    expect(atr(flatCandles(5), 14)).toBeNaN();
  });

  it('returns 0 on a perfectly flat series', () => {
    expect(atr(flatCandles(30), 14)).toBe(0);
  });
});

describe('detectMeanRevSignal', () => {
  it('returns no signal when warming up', () => {
    const sig = detectMeanRevSignal(flatCandles(5), flatCandles(5));
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/warming up/);
  });

  it('returns no signal on a constant series (BB collapses, close = middle)', () => {
    const candles1H = flatCandles(40, 100);
    const candles15M = flatCandles(40, 100);
    const sig = detectMeanRevSignal(candles1H, candles15M);
    expect(sig.side).toBeNull();
  });

  it('emits BUY when close pierces lower band and 15M RSI is oversold', () => {
    // 1H: 40 candles oscillating between 100 and 110, then a deep drop to 80.
    const baseCloses = Array.from({ length: 40 }, (_, i) => 100 + (i % 5 === 0 ? 10 : 0));
    baseCloses.push(80); // sharp drop below BB lower (which sits ~95 here)
    const candles1H = candlesFromCloses(baseCloses);
    // 15M: a steep downtrend → RSI < 30
    const candles15M = candlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 - i));
    const sig = detectMeanRevSignal(candles1H, candles15M);
    expect(sig.side).toBe('BUY');
    expect(sig.tp).toBeGreaterThan(sig.entryPrice);
    expect(sig.sl).toBeLessThan(sig.entryPrice);
    expect(sig.rr).toBeGreaterThan(0);
    expect(sig.reason).toMatch(/BB lower pierced/);
  });

  it('emits SELL when close pierces upper band and 15M RSI is overbought', () => {
    const baseCloses = Array.from({ length: 40 }, (_, i) => 100 - (i % 5 === 0 ? 10 : 0));
    baseCloses.push(120); // sharp rally above BB upper
    const candles1H = candlesFromCloses(baseCloses);
    // 15M: a steep uptrend → RSI > 70
    const candles15M = candlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    const sig = detectMeanRevSignal(candles1H, candles15M);
    expect(sig.side).toBe('SELL');
    expect(sig.tp).toBeLessThan(sig.entryPrice);
    expect(sig.sl).toBeGreaterThan(sig.entryPrice);
    expect(sig.rr).toBeGreaterThan(0);
    expect(sig.reason).toMatch(/BB upper pierced/);
  });

  it('blocks a setup when R:R falls below the floor', () => {
    // Construct a 1H series where bb.lower is barely below close → tiny reward
    // but the SL adds 1.5 × ATR → large risk → rr < 1.5.
    const baseCloses = Array.from({ length: 25 }, (_, i) => 100 + (i % 2));
    baseCloses.push(99);
    const candles1H = candlesFromCloses(baseCloses);
    const candles15M = candlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 - i));
    const sig = detectMeanRevSignal(candles1H, candles15M, {
      ...DEFAULT_MEAN_REV_CONFIG,
      rrFloor: 999, // unreachable
    });
    expect(sig.side).toBeNull();
  });

  it('passes meta with all five indicator values when blocked', () => {
    const candles1H = candlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i));
    const candles15M = candlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 + i));
    const sig = detectMeanRevSignal(candles1H, candles15M);
    expect(sig.side).toBeNull();
    expect(Number.isFinite(sig.meta.bbUpper)).toBe(true);
    expect(Number.isFinite(sig.meta.bbMiddle)).toBe(true);
    expect(Number.isFinite(sig.meta.bbLower)).toBe(true);
    expect(Number.isFinite(sig.meta.rsi)).toBe(true);
    expect(Number.isFinite(sig.meta.atr)).toBe(true);
  });

  it('respects custom oversold threshold (set to 0 so RSI<0 is unreachable)', () => {
    // RSI is in [0,100]. Setting rsiOversold=0 makes the strict `<` check
    // impossible to satisfy, regardless of how oversold the 15M is.
    const baseCloses = Array.from({ length: 40 }, (_, i) => 100 + (i % 5 === 0 ? 10 : 0));
    baseCloses.push(80);
    const candles1H = candlesFromCloses(baseCloses);
    const candles15M = candlesFromCloses(Array.from({ length: 30 }, (_, i) => 100 - i));
    const sig = detectMeanRevSignal(candles1H, candles15M, {
      ...DEFAULT_MEAN_REV_CONFIG,
      rsiOversold: 0,
    });
    expect(sig.side).toBeNull();
  });
});
