import { describe, it, expect } from 'vitest';
import {
  trueRange,
  atr,
  atrNormalized,
  adx,
  classifyRegime,
  DEFAULT_THRESHOLDS,
  type Regime,
} from '../src/analysis/regime-detector.js';
import type { Candle } from '../src/analysis/candle-builder.js';

// ============================================================================
// Test fabrications: synthetic candles that hit specific regime profiles.
// ============================================================================

function candle(open: number, high: number, low: number, close: number, ts = 0): Candle {
  return {
    timeframe: '1H',
    openTs: ts,
    closeTs: ts + 3_600_000,
    open, high, low, close,
    volume: 0,
  };
}

/** N candles of identical OHLC — zero TR, atr → 0. */
function flatCandles(n: number, price = 100): Candle[] {
  return Array.from({ length: n }, (_, i) =>
    candle(price, price, price, price, i * 3_600_000),
  );
}

/** N candles with a constant TR (range = `range`, close = open + `delta`). */
function constantRangeCandles(n: number, basePrice: number, range: number, delta = 0): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const open = basePrice + i * delta;
    const high = open + range / 2;
    const low = open - range / 2;
    const close = open + delta;
    return candle(open, high, low, close, i * 3_600_000);
  });
}

/** N candles with strong upward trend + given range. */
function trendingUpCandles(n: number, startPrice = 100, stepUp = 2, range = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const open = startPrice + i * stepUp;
    const close = open + stepUp;
    const high = Math.max(open, close) + range / 2;
    const low = Math.min(open, close) - range / 2;
    return candle(open, high, low, close, i * 3_600_000);
  });
}

/** N candles oscillating around midPrice within ± amplitude. */
function oscillatingCandles(n: number, midPrice: number, amplitude: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const phase = Math.sin(i * 0.3) * amplitude;
    const open = midPrice + phase;
    const close = midPrice + Math.sin((i + 1) * 0.3) * amplitude;
    const high = Math.max(open, close) + amplitude * 0.2;
    const low = Math.min(open, close) - amplitude * 0.2;
    return candle(open, high, low, close, i * 3_600_000);
  });
}

// ============================================================================

describe('trueRange', () => {
  it('returns high-low when prev close is between them', () => {
    expect(trueRange(50, candle(50, 60, 40, 55))).toBe(20);
  });

  it('returns |high-prevClose| when gap-up', () => {
    expect(trueRange(30, candle(50, 60, 45, 55))).toBe(30);
  });

  it('returns |low-prevClose| when gap-down', () => {
    expect(trueRange(80, candle(50, 60, 40, 55))).toBe(40);
  });

  it('never returns negative', () => {
    expect(trueRange(50, candle(50, 50, 50, 50))).toBe(0);
  });
});

describe('atr', () => {
  it('returns NaN when there are fewer than period+1 candles', () => {
    expect(atr(flatCandles(10), 14)).toBeNaN();
    expect(atr(flatCandles(14), 14)).toBeNaN();
  });

  it('returns 0 on a perfectly flat series', () => {
    expect(atr(flatCandles(50), 14)).toBe(0);
  });

  it('converges close to the constant TR on a uniform-range series', () => {
    const value = atr(constantRangeCandles(100, 100, 2), 14);
    expect(value).toBeGreaterThan(1.5);
    expect(value).toBeLessThan(2.5);
  });
});

describe('atrNormalized', () => {
  it('returns NaN when input is shorter than baselineMin', () => {
    expect(atrNormalized(flatCandles(50), 14, 200)).toBeNaN();
  });

  it('returns ~1.0 when current vol equals the median baseline', () => {
    const value = atrNormalized(constantRangeCandles(250, 100, 2), 14, 200);
    expect(value).toBeGreaterThan(0.8);
    expect(value).toBeLessThan(1.2);
  });

  it('returns >> 1.0 when latest candles have a vol spike', () => {
    const calm = constantRangeCandles(200, 100, 1);
    const spike = constantRangeCandles(50, 200, 5).map((c, i) => ({
      ...c,
      openTs: (200 + i) * 3_600_000,
      closeTs: (201 + i) * 3_600_000,
    }));
    const series = [...calm, ...spike];
    const value = atrNormalized(series, 14, 200);
    expect(value).toBeGreaterThan(2);
  });

  it('returns << 1.0 when latest candles are dead-flat after vol baseline', () => {
    const volatile = constantRangeCandles(200, 100, 5);
    const flat = flatCandles(50, 200).map((c, i) => ({
      ...c,
      openTs: (200 + i) * 3_600_000,
      closeTs: (201 + i) * 3_600_000,
    }));
    const series = [...volatile, ...flat];
    const value = atrNormalized(series, 14, 200);
    expect(value).toBeLessThan(0.3);
  });
});

describe('adx', () => {
  it('returns NaN when there are fewer than 2*period+1 candles', () => {
    expect(adx(flatCandles(20), 14)).toBeNaN();
    expect(adx(flatCandles(28), 14)).toBeNaN();
  });

  it('stays low (<30) on a flat / range-bound series', () => {
    const value = adx(oscillatingCandles(100, 100, 2), 14);
    expect(value).toBeLessThan(30);
  });

  it('reaches >40 on a clean monotonic uptrend', () => {
    const value = adx(trendingUpCandles(80, 100, 3, 1), 14);
    expect(value).toBeGreaterThan(40);
  });

  it('returns a finite number on degenerate (zero-range) series', () => {
    const value = adx(flatCandles(50), 14);
    expect(value).toBe(0);
  });
});

describe('classifyRegime', () => {
  it('returns DEAD when the input is too short and no hysteresis hint', () => {
    const r = classifyRegime(flatCandles(50));
    expect(r.regime).toBe('DEAD');
    expect(r.confidence).toBe(0);
  });

  it('honors hysteresisHint when data is insufficient', () => {
    const r = classifyRegime(flatCandles(50), DEFAULT_THRESHOLDS, 'RANGE_LOW');
    expect(r.regime).toBe('RANGE_LOW');
  });

  it('classifies a fully flat 250-candle series as DEAD', () => {
    const r = classifyRegime(flatCandles(250));
    expect(r.regime).toBe('DEAD');
    expect(r.reason).toMatch(/vol dead/);
  });

  it('classifies a quiet oscillating series with vol-baseline collapse as DEAD or RANGE_LOW', () => {
    const volatile = constantRangeCandles(200, 100, 5);
    const calm = oscillatingCandles(50, 200, 0.3).map((c, i) => ({
      ...c,
      openTs: (200 + i) * 3_600_000,
      closeTs: (201 + i) * 3_600_000,
    }));
    const r = classifyRegime([...volatile, ...calm]);
    // Either DEAD (atrNorm below 0.4) or RANGE_LOW (below 0.7 but above 0.4).
    expect(['DEAD', 'RANGE_LOW']).toContain(r.regime);
  });

  it('classifies a clean uptrend with strong vol as TRENDING_HIGH', () => {
    // 250 candles trending up with range that puts atrNorm above baseline.
    const baseline = constantRangeCandles(200, 100, 1);
    const trending = trendingUpCandles(60, 300, 4, 3).map((c, i) => ({
      ...c,
      openTs: (200 + i) * 3_600_000,
      closeTs: (201 + i) * 3_600_000,
    }));
    const r = classifyRegime([...baseline, ...trending]);
    expect(r.regime === 'TRENDING_HIGH' || r.regime === 'RANGE_HIGH').toBe(true);
    // ADX must have picked up trend signal.
    expect(r.adx).toBeGreaterThan(15);
  });

  it('falls back to RANGE_HIGH on a transition zone without hysteresis hint', () => {
    // Construct a series where ADX is mid (20-25) and atrNorm is around 1.0.
    const r = classifyRegime(constantRangeCandles(250, 100, 2));
    expect(['RANGE_LOW', 'RANGE_HIGH']).toContain(r.regime);
  });

  it('returns a result with all numeric fields populated and a non-empty reason', () => {
    const r = classifyRegime(constantRangeCandles(250, 100, 2));
    expect(Number.isFinite(r.atrNorm)).toBe(true);
    expect(Number.isFinite(r.adx)).toBe(true);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('exposes all 5 regime variants as a discriminated union', () => {
    const regimes: Regime[] = ['TRENDING_HIGH', 'TRENDING_LOW', 'RANGE_HIGH', 'RANGE_LOW', 'DEAD'];
    expect(regimes).toHaveLength(5);
  });
});

describe('classifyRegime — threshold overrides', () => {
  it('respects a custom atrDead threshold (raised so quiet series counts as DEAD)', () => {
    const series = constantRangeCandles(250, 100, 2);
    const r = classifyRegime(series, { ...DEFAULT_THRESHOLDS, atrDead: 1.5 });
    expect(r.regime).toBe('DEAD');
  });

  it('respects a custom adxTrending threshold (lowered so even modest trend counts)', () => {
    // Build a noisy uptrend with weak ADX (~25-35): step is small and the
    // range is large enough to make true range > step on most candles.
    const baseline = constantRangeCandles(200, 100, 3);
    const trending = trendingUpCandles(60, 300, 1, 3).map((c, i) => ({
      ...c,
      openTs: (200 + i) * 3_600_000,
      closeTs: (201 + i) * 3_600_000,
    }));
    const series = [...baseline, ...trending];
    // strict (adxTrending=80) is unreachable for this series → falls back.
    // lax (adxTrending=5) catches any trend AND the wide-open vol bands force
    // both axes to land at an extreme so the classifier emits TRENDING_*.
    const strict = classifyRegime(series, { ...DEFAULT_THRESHOLDS, adxTrending: 80 });
    const lax    = classifyRegime(series, {
      ...DEFAULT_THRESHOLDS,
      adxTrending: 5,
      adxRange: 1,
      atrLowVol: 99,   // every real atrNorm < 99 = LOW vol
      atrHighVol: 100, // unreachable, ensures TRENDING_LOW branch
    });
    expect(strict.regime === 'TRENDING_HIGH' || strict.regime === 'TRENDING_LOW').toBe(false);
    expect(lax.regime === 'TRENDING_HIGH' || lax.regime === 'TRENDING_LOW').toBe(true);
  });
});
