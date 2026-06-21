import { describe, it, expect } from 'vitest';
import {
  ema,
  atr,
  adx,
  volumeRatio,
  swingPoints,
  detectMomentumSignal,
  DEFAULT_MOMENTUM_CONFIG,
} from '../src/strategies/momentum-breakout.js';
import type { Candle } from '../src/analysis/candle-builder.js';

function candle(
  open: number, high: number, low: number, close: number,
  volume = 1, ts = 0,
): Candle {
  return {
    timeframe: '5M',
    openTs: ts,
    closeTs: ts + 300_000,
    open, high, low, close, volume,
  };
}

function flatCandles(n: number, price = 100, volume = 1): Candle[] {
  return Array.from({ length: n }, (_, i) =>
    candle(price, price, price, price, volume, i * 300_000),
  );
}

/**
 * Build a synthetic uptrend with controllable step, range, and trailing
 * volume burst on the last `surgeWindow` candles.
 */
function uptrendCandles(opts: {
  n: number;
  start: number;
  step: number;
  range: number;
  baseVolume: number;
  surgeMultiplier: number;
  surgeWindow: number;
}): Candle[] {
  return Array.from({ length: opts.n }, (_, i) => {
    const open = opts.start + i * opts.step;
    const close = open + opts.step;
    const high = Math.max(open, close) + opts.range / 2;
    const low = Math.min(open, close) - opts.range / 2;
    const inSurge = i >= opts.n - opts.surgeWindow;
    const volume = inSurge ? opts.baseVolume * opts.surgeMultiplier : opts.baseVolume;
    return candle(open, high, low, close, volume, i * 300_000);
  });
}

// ============================================================================

describe('ema', () => {
  it('returns NaN when input is shorter than period', () => {
    expect(ema([1, 2, 3], 5)).toBeNaN();
  });

  it('equals the SMA seed on the boundary', () => {
    // After exactly period values, EMA == SMA of those values.
    expect(ema([10, 20, 30, 40, 50], 5)).toBeCloseTo(30, 6);
  });

  it('tracks a constant series exactly', () => {
    expect(ema(new Array(50).fill(42), 14)).toBeCloseTo(42, 6);
  });
});

describe('atr (momentum module copy)', () => {
  it('returns NaN when input is shorter than period + 1', () => {
    expect(atr(flatCandles(10), 14)).toBeNaN();
  });

  it('returns 0 on flat candles', () => {
    expect(atr(flatCandles(30), 14)).toBe(0);
  });
});

describe('adx (momentum module copy)', () => {
  it('returns NaN when input is shorter than 2*period + 1', () => {
    expect(adx(flatCandles(20), 14)).toBeNaN();
  });

  it('returns finite low value (~0) on flat candles', () => {
    const value = adx(flatCandles(50), 14);
    expect(value).toBe(0);
  });

  it('returns high (>40) on clean uptrend', () => {
    const candles = uptrendCandles({
      n: 60, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 1, surgeWindow: 0,
    });
    expect(adx(candles, 14)).toBeGreaterThan(40);
  });
});

describe('volumeRatio', () => {
  it('returns 0 when input is shorter than baseline', () => {
    expect(volumeRatio(flatCandles(10, 100, 5), 5, 20)).toBe(0);
  });

  it('returns 1 when recent and baseline volume are equal', () => {
    expect(volumeRatio(flatCandles(25, 100, 10), 5, 20)).toBeCloseTo(1, 6);
  });

  it('returns ratio matching the surge math (recent / wide avg)', () => {
    // 20 candles vol=1, 5 candles vol=3 appended.
    // recent(5) avg = 3; wide(20) avg = (15×1 + 5×3) / 20 = 1.5; ratio = 2.
    const candles = flatCandles(20, 100, 1);
    candles.push(...flatCandles(5, 100, 3).map((c, i) => ({
      ...c, openTs: (20 + i) * 300_000, closeTs: (21 + i) * 300_000,
    })));
    expect(volumeRatio(candles, 5, 20)).toBeCloseTo(2.0, 6);
  });

  it('returns 0 when baseline volume is zero', () => {
    expect(volumeRatio(flatCandles(25, 100, 0), 5, 20)).toBe(0);
  });
});

describe('swingPoints', () => {
  it('finds min low and max high over lookback', () => {
    const candles = [
      candle(100, 105, 95, 100),
      candle(100, 110, 96, 100),
      candle(100, 108, 90, 100),
    ];
    const swings = swingPoints(candles, 10);
    expect(swings.low).toBe(90);
    expect(swings.high).toBe(110);
  });
});

describe('detectMomentumSignal', () => {
  it('returns no signal when warming up', () => {
    const sig = detectMomentumSignal(flatCandles(10));
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/warming up/);
  });

  it('returns no signal on flat candles (adx=0)', () => {
    const sig = detectMomentumSignal(flatCandles(80, 100, 1));
    expect(sig.side).toBeNull();
  });

  it('blocks BUY when volume ratio is below floor (flat volume on uptrend)', () => {
    const candles = uptrendCandles({
      n: 80, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 1, surgeWindow: 0,
    });
    const sig = detectMomentumSignal(candles);
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/vol ratio/);
  });

  it('emits BUY on clean uptrend + volume surge', () => {
    const candles = uptrendCandles({
      n: 80, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 3, surgeWindow: 5,
    });
    const sig = detectMomentumSignal(candles);
    expect(sig.side).toBe('BUY');
    expect(sig.tp).toBeGreaterThan(sig.entryPrice);
    expect(sig.sl).toBeLessThan(sig.entryPrice);
    expect(sig.rr).toBeGreaterThanOrEqual(DEFAULT_MOMENTUM_CONFIG.rrFloor);
  });

  it('emits SELL on clean downtrend + volume surge', () => {
    // Downtrend = reverse the trick: open above close every bar.
    const candles = Array.from({ length: 80 }, (_, i) => {
      const open = 200 - i * 2;
      const close = open - 2;
      const high = Math.max(open, close) + 0.5;
      const low = Math.min(open, close) - 0.5;
      const volume = i >= 75 ? 3 : 1;
      return candle(open, high, low, close, volume, i * 300_000);
    });
    const sig = detectMomentumSignal(candles);
    expect(sig.side).toBe('SELL');
    expect(sig.tp).toBeLessThan(sig.entryPrice);
    expect(sig.sl).toBeGreaterThan(sig.entryPrice);
  });

  it('blocks entry when ADX floor is set higher than reachable', () => {
    // Strict-monotonic uptrend → ADX saturates near 100. Use 999 as unreachable.
    const candles = uptrendCandles({
      n: 80, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 3, surgeWindow: 5,
    });
    const sig = detectMomentumSignal(candles, {
      ...DEFAULT_MOMENTUM_CONFIG,
      adxFloor: 999,
    });
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/adx/);
  });

  it('blocks entry when R:R floor pushes above achievable', () => {
    const candles = uptrendCandles({
      n: 80, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 3, surgeWindow: 5,
    });
    const sig = detectMomentumSignal(candles, {
      ...DEFAULT_MOMENTUM_CONFIG,
      rrFloor: 999,
    });
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/R:R floor/);
  });

  it('returns meta with all seven indicators populated when blocked', () => {
    const candles = uptrendCandles({
      n: 80, start: 100, step: 2, range: 1,
      baseVolume: 1, surgeMultiplier: 1, surgeWindow: 0,
    });
    const sig = detectMomentumSignal(candles);
    expect(sig.side).toBeNull();
    expect(Number.isFinite(sig.meta.ema20)).toBe(true);
    expect(Number.isFinite(sig.meta.ema50)).toBe(true);
    expect(Number.isFinite(sig.meta.adx)).toBe(true);
    expect(Number.isFinite(sig.meta.volRatio)).toBe(true);
    expect(Number.isFinite(sig.meta.atr)).toBe(true);
    expect(Number.isFinite(sig.meta.swingLow)).toBe(true);
    expect(Number.isFinite(sig.meta.swingHigh)).toBe(true);
  });
});
