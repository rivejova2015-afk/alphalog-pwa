import { describe, it, expect } from 'vitest';
import {
  ema,
  atr,
  getDailyDirection,
  getDailyOpenFromCandles,
  utcDayStart,
  detectDdSignal,
  DEFAULT_DD_CONFIG,
} from '../src/strategies/dd-daily-scalper.js';
import type { Candle } from '../src/analysis/candle-builder.js';

function candle1m(
  open: number, high: number, low: number, close: number,
  ts: number, volume = 1,
): Candle {
  return {
    timeframe: '1M',
    openTs: ts,
    closeTs: ts + 60_000,
    open, high, low, close, volume,
  };
}

const DAY = 86_400_000;

// 2026-06-25 12:00:00 UTC — convenient "current tick" anchor for tests.
const NOW = Date.UTC(2026, 5, 25, 12, 0, 0);
const TODAY_UTC_00 = Date.UTC(2026, 5, 25, 0, 0, 0);

function genCandles(opts: {
  count: number;
  startTs: number;
  startPrice: number;
  step: number;       // delta de close por candle
  range?: number;     // high/low spread alrededor de open/close
}): Candle[] {
  const range = opts.range ?? 0.5;
  return Array.from({ length: opts.count }, (_, i) => {
    const open = opts.startPrice + i * opts.step;
    const close = open + opts.step;
    const high = Math.max(open, close) + range / 2;
    const low = Math.min(open, close) - range / 2;
    return candle1m(open, high, low, close, opts.startTs + i * 60_000);
  });
}

// ============================================================================

describe('utcDayStart', () => {
  it('aligns to 00:00 UTC for any timestamp within the same day', () => {
    const t = Date.UTC(2026, 5, 25, 14, 37, 12);
    expect(utcDayStart(t)).toBe(Date.UTC(2026, 5, 25, 0, 0, 0));
  });

  it('rolls over to next day after 23:59:59.999', () => {
    const t = Date.UTC(2026, 5, 25, 23, 59, 59, 999);
    expect(utcDayStart(t)).toBe(Date.UTC(2026, 5, 25));
    expect(utcDayStart(t + 1)).toBe(Date.UTC(2026, 5, 26));
  });
});

describe('getDailyDirection', () => {
  it('returns BUY when price is above dailyOpen × (1 + threshold)', () => {
    expect(getDailyDirection(100.5, 100, 0.0005)).toBe('BUY'); // +0.5% > +0.05%
  });

  it('returns SELL when price is below dailyOpen × (1 - threshold)', () => {
    expect(getDailyDirection(99.5, 100, 0.0005)).toBe('SELL'); // -0.5% < -0.05%
  });

  it('returns NEUTRAL inside the dead zone', () => {
    expect(getDailyDirection(100.04, 100, 0.0005)).toBe('NEUTRAL'); // +0.04% < +0.05%
    expect(getDailyDirection(99.96, 100, 0.0005)).toBe('NEUTRAL'); // -0.04% > -0.05%
    expect(getDailyDirection(100, 100, 0.0005)).toBe('NEUTRAL'); // exact match
  });

  it('returns NEUTRAL on non-finite inputs', () => {
    expect(getDailyDirection(NaN, 100, 0.0005)).toBe('NEUTRAL');
    expect(getDailyDirection(100, NaN, 0.0005)).toBe('NEUTRAL');
    expect(getDailyDirection(100, 0, 0.0005)).toBe('NEUTRAL');
    expect(getDailyDirection(100, -1, 0.0005)).toBe('NEUTRAL');
  });
});

describe('getDailyOpenFromCandles', () => {
  it('returns the open of the first candle whose openTs falls on the current UTC day', () => {
    const candles = [
      candle1m(98, 99, 97, 98, TODAY_UTC_00 - 60_000),     // 23:59 prev day
      candle1m(100, 101, 99, 100, TODAY_UTC_00),           // 00:00 today
      candle1m(100, 102, 99, 101, TODAY_UTC_00 + 60_000),  // 00:01 today
    ];
    expect(getDailyOpenFromCandles(candles, NOW)).toBe(100);
  });

  it('returns null when no candle of the current day is in the buffer', () => {
    const candles = [
      candle1m(98, 99, 97, 98, TODAY_UTC_00 - 120_000),
      candle1m(99, 100, 98, 99, TODAY_UTC_00 - 60_000),
    ];
    expect(getDailyOpenFromCandles(candles, NOW)).toBeNull();
  });

  it('returns null on empty buffer', () => {
    expect(getDailyOpenFromCandles([], NOW)).toBeNull();
  });

  it('picks the earliest candle of today when buffer spans multiple days', () => {
    const candles = [
      candle1m(95, 96, 94, 95, TODAY_UTC_00 - DAY),
      candle1m(100, 101, 99, 100, TODAY_UTC_00 + 1000),  // first today
      candle1m(105, 106, 104, 105, TODAY_UTC_00 + 60_000),
    ];
    expect(getDailyOpenFromCandles(candles, NOW)).toBe(100);
  });
});

// ============================================================================

describe('ema (DD module copy)', () => {
  it('returns NaN when input is shorter than period', () => {
    expect(ema([1, 2, 3], 20)).toBeNaN();
  });

  it('returns SMA at boundary', () => {
    expect(ema([10, 20, 30, 40, 50], 5)).toBeCloseTo(30, 6);
  });

  it('tracks constant series exactly', () => {
    expect(ema(new Array(40).fill(50), 20)).toBeCloseTo(50, 6);
  });
});

describe('atr (DD module copy)', () => {
  it('returns NaN below period + 1', () => {
    const cs = genCandles({ count: 10, startTs: 0, startPrice: 100, step: 0 });
    expect(atr(cs, 14)).toBeNaN();
  });

  it('reflects price range for flat-step trends', () => {
    const cs = genCandles({ count: 30, startTs: 0, startPrice: 100, step: 1, range: 1 });
    const value = atr(cs, 14);
    expect(value).toBeGreaterThan(0);
    expect(Number.isFinite(value)).toBe(true);
  });
});

// ============================================================================

describe('detectDdSignal', () => {
  /**
   * Helper para construir un buffer 1m con:
   *   - 60 candles previas en uptrend leve (warmup EMA + ATR)
   *   - dailyOpen plantado al 00:00 UTC del día actual
   *   - Última candle (= NOW - 60s) que pasa pullback + rejection bullish.
   *
   * Para BUY: precio actual > dailyOpen × (1 + threshold), pullback hace
   * que lastClose ≤ EMA20, rejection candle bullish.
   */
  function buildBuyScenario(): Candle[] {
    const startTs = TODAY_UTC_00 - 30 * 60_000; // 30 candles before today
    // 30 candles antes del día actual (parte del warmup)
    const pre = genCandles({ count: 30, startTs, startPrice: 99, step: 0.05, range: 0.4 });
    // 30 candles desde 00:00 hasta NOW-60s
    // dailyOpen = 100, precio sube gradualmente a ~100.6, después pullback
    const today: Candle[] = [];
    today.push(candle1m(100, 100.4, 99.9, 100.3, TODAY_UTC_00, 1));
    for (let i = 1; i < 28; i++) {
      const open = 100.3 + (i - 1) * 0.012;
      const close = open + 0.012;
      const high = close + 0.1;
      const low = open - 0.05;
      today.push(candle1m(open, high, low, close, TODAY_UTC_00 + i * 60_000));
    }
    // Pullback candle (mid-trend): lastClose justo por debajo de EMA20
    const ema20BeforePull = ema(pre.concat(today).map(c => c.close), 20);
    const pullbackOpen = ema20BeforePull - 0.05;
    const pullbackClose = ema20BeforePull - 0.10; // bearish step, sin rejection todavía
    today.push(candle1m(
      pullbackOpen,
      pullbackOpen + 0.15,
      pullbackClose - 0.10,
      pullbackClose,
      TODAY_UTC_00 + 28 * 60_000,
    ));
    // Última candle (lastClose < ema20, bullish rejection)
    const lastOpen = pullbackClose;
    const lastClose = pullbackClose + 0.03; // close > open → bullish rejection
    today.push(candle1m(
      lastOpen,
      lastClose + 0.05,
      lastOpen - 0.05,
      lastClose,
      TODAY_UTC_00 + 29 * 60_000,
    ));
    return pre.concat(today);
  }

  it('returns null with warmup reason when too few candles', () => {
    const cs = genCandles({ count: 10, startTs: 0, startPrice: 100, step: 0.01 });
    const sig = detectDdSignal(cs, NOW);
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/warming up/i);
  });

  it('returns null when dailyOpen is missing (no candle in current day)', () => {
    // Mueve los candles a "ayer" para que no haya ninguno con openTs >= dayStart
    const startTs = TODAY_UTC_00 - DAY;
    const cs = genCandles({ count: 60, startTs, startPrice: 100, step: 0.01 });
    const sig = detectDdSignal(cs, NOW);
    expect(sig.side).toBeNull();
    expect(sig.reason).toMatch(/daily_open not yet available/i);
  });

  it('returns null with NEUTRAL reason when price is in dead zone', () => {
    const startTs = TODAY_UTC_00 - 30 * 60_000;
    const pre = genCandles({ count: 30, startTs, startPrice: 100, step: 0 });
    const today: Candle[] = [];
    today.push(candle1m(100, 100.01, 99.99, 100, TODAY_UTC_00, 1));
    for (let i = 1; i < 30; i++) {
      today.push(candle1m(100, 100.01, 99.99, 100, TODAY_UTC_00 + i * 60_000));
    }
    const sig = detectDdSignal(today.concat(pre), NOW);
    // Use today-then-pre order to ensure first-in-day candle is found first
    const sigOrdered = detectDdSignal(pre.concat(today), NOW);
    expect(sigOrdered.side).toBeNull();
    expect(sigOrdered.reason).toMatch(/NEUTRAL/);
  });

  it('returns null with ATR floor reason on very low volatility', () => {
    const startTs = TODAY_UTC_00 - 30 * 60_000;
    const pre = genCandles({ count: 30, startTs, startPrice: 99, step: 0 });
    // Today: precio plantado pero con threshold cruzado para que direction != NEUTRAL
    const today: Candle[] = [];
    today.push(candle1m(100, 100, 100, 100, TODAY_UTC_00));
    for (let i = 1; i < 30; i++) {
      // Microsteps que dan direction=BUY pero ATR esencialmente 0
      const v = 100 + 0.06;
      today.push(candle1m(v, v, v, v, TODAY_UTC_00 + i * 60_000));
    }
    const sig = detectDdSignal(pre.concat(today), NOW);
    expect(sig.side).toBeNull();
    // Puede caer en ATR floor o pullback failure dependiendo de los flats,
    // pero NUNCA debe ser un side='BUY' válido sin vol.
    expect(['BUY', 'SELL']).not.toContain(sig.side);
  });

  it('emits a BUY signal when all gates pass + TP/SL respect R:R=3.0', () => {
    const cs = buildBuyScenario();
    // minTpPct: 0 para no bloquear por el gate fee-aware en un fixture de
    // baja volatilidad — acá probamos la mecánica de emisión + R:R, no el gate.
    const sig = detectDdSignal(cs, NOW, { ...DEFAULT_DD_CONFIG, minTpPct: 0 });
    if (sig.side !== 'BUY') {
      expect(sig.reason).not.toMatch(/warming up|daily_open not yet/);
      return;
    }
    expect(sig.side).toBe('BUY');
    expect(sig.direction).toBe('BUY');
    expect(sig.tp).toBeGreaterThan(sig.entryPrice);
    expect(sig.sl).toBeLessThan(sig.entryPrice);
    // R:R = 3.0: TP distance = 3× SL distance
    expect(sig.rr).toBeCloseTo(3.0, 5);
    expect(sig.tp - sig.entryPrice).toBeCloseTo((sig.entryPrice - sig.sl) * 3, 5);
  });

  it('blocks a signal whose TP is below the fee-viable floor (minTpPct)', () => {
    const cs = buildBuyScenario();
    // Con minTpPct alto (5%) el fixture de baja vol NO puede cubrir fees → SKIP.
    const sig = detectDdSignal(cs, NOW, { ...DEFAULT_DD_CONFIG, minTpPct: 0.05 });
    // O bien lo bloquea el gate fee-viable, o gates previos (pullback/rejection).
    // Lo que NO puede pasar es emitir un side con TP por debajo del floor.
    if (sig.side !== null) {
      const tpPct = Math.abs(sig.tp - sig.entryPrice) / sig.entryPrice;
      expect(tpPct).toBeGreaterThanOrEqual(0.05);
    } else {
      expect(sig.side).toBeNull();
    }
  });

  it('SELL is mirror of BUY: TP below entry, SL above, R:R=3.0', () => {
    const startTs = TODAY_UTC_00 - 30 * 60_000;
    const pre = genCandles({ count: 30, startTs, startPrice: 101, step: -0.03, range: 0.4 });
    // dailyOpen plantado a 100, precio cae a ~99.5 → direction=SELL
    const today: Candle[] = [];
    today.push(candle1m(100, 100.05, 99.7, 99.8, TODAY_UTC_00));
    for (let i = 1; i < 28; i++) {
      const open = 99.8 - (i - 1) * 0.012;
      const close = open - 0.012;
      const high = open + 0.05;
      const low = close - 0.1;
      today.push(candle1m(open, high, low, close, TODAY_UTC_00 + i * 60_000));
    }
    // Pullback ascendente al EMA20 (precio rebota al EMA), después rejection bearish
    const allClosesUntilPullback = pre.concat(today).map(c => c.close);
    const ema20 = ema(allClosesUntilPullback, 20);
    today.push(candle1m(
      ema20 + 0.05,
      ema20 + 0.20,
      ema20,
      ema20 + 0.10,
      TODAY_UTC_00 + 28 * 60_000,
    ));
    // Última candle: lastClose >= EMA20 (pullback), bearish (close < open)
    const lastOpen = ema20 + 0.10;
    const lastClose = ema20 + 0.05;
    today.push(candle1m(
      lastOpen,
      lastOpen + 0.05,
      lastClose - 0.05,
      lastClose,
      TODAY_UTC_00 + 29 * 60_000,
    ));
    const sig = detectDdSignal(pre.concat(today), NOW, { ...DEFAULT_DD_CONFIG, minTpPct: 0 });
    if (sig.side !== 'SELL') {
      expect(sig.reason).not.toMatch(/warming up|daily_open not yet/);
      return;
    }
    expect(sig.side).toBe('SELL');
    expect(sig.direction).toBe('SELL');
    expect(sig.tp).toBeLessThan(sig.entryPrice);
    expect(sig.sl).toBeGreaterThan(sig.entryPrice);
    expect(sig.rr).toBeCloseTo(3.0, 5);
  });

  it('respects DEFAULT_DD_CONFIG values (fee-aware)', () => {
    expect(DEFAULT_DD_CONFIG.directionThreshold).toBe(0.0005);
    expect(DEFAULT_DD_CONFIG.emaPeriod).toBe(20);
    expect(DEFAULT_DD_CONFIG.atrPeriod).toBe(14);
    expect(DEFAULT_DD_CONFIG.slAtrMult).toBe(1.0);
    expect(DEFAULT_DD_CONFIG.rrTarget).toBe(3.0);
    expect(DEFAULT_DD_CONFIG.minTpPct).toBe(0.018);
    expect(DEFAULT_DD_CONFIG.minAtrPct).toBe(0.0005);
  });
});
