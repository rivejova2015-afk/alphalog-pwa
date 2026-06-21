/**
 * detectLiquiditySweep — unit coverage.
 *
 * Background: this detector accounts for ~46% of all SKIP decisions in
 * coinarb_decisions over the last 6h ("liquidity-sweep: not detected").
 * Before deciding whether to relax SWEEP_CONFIRM_BODY_RATIO or fix the
 * detector, we add coverage to make sure the existing behavior is
 * actually correct.
 *
 * Algorithm (smc-detector.ts:248-276):
 *   BUYSIDE — wick above EQH that closes BELOW the EQH range + 1m bearish
 *             confirmation candle (body/range ≥ ratio).
 *   SELLSIDE — mirror: wick below EQL that closes ABOVE the EQL range +
 *              1m bullish confirmation candle.
 *
 * Conclusion (after writing these tests): the detector has no bug. The
 * restrictive behavior IS the intended SMC liquidity sweep semantics:
 *   - the wick must FULLY cross the EQH/EQL boundary
 *   - the 5m close must REJECT back across the zone
 *   - the 1m must be a strong-bodied candle in the rejection direction
 * In a lateral market without obvious liquidity manipulations, this is
 * legitimately rare. Calibration (lowering SWEEP_CONFIRM_BODY_RATIO from
 * 0.40 → 0.35) is the right knob to relax, not the detector logic itself.
 */

import { describe, it, expect } from 'vitest';
import { detectLiquiditySweep } from '../src/analysis/smc-detector.js';
import type { Candle } from '../src/analysis/candle-builder.js';
import type { SmcSignal, SmcZone } from '../src/analysis/smc-detector.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function bar(open: number, high: number, low: number, close: number, idx = 0): Candle {
  const openTs = 1_700_000_000_000 + idx * 60_000;
  return {
    timeframe: '5M',
    openTs,
    closeTs: openTs + 60_000,
    open, high, low, close,
    volume: 1,
  };
}

function pad5(extra: Candle): Candle[] {
  return [bar(100, 101, 99, 100, 0), bar(100, 101, 99, 100, 1), bar(100, 101, 99, 100, 2), bar(100, 101, 99, 100, 3), extra];
}

function pad3(extra: Candle): Candle[] {
  return [bar(100, 101, 99, 100, 0), bar(100, 101, 99, 100, 1), extra];
}

function signal(zones: SmcZone[]): SmcSignal {
  return { bias: 'NEUTRAL', confidence: 0, bos: false, choch: false, zones, swingHigh: null, swingLow: null };
}

const eqh = (low: number, high: number): SmcZone => ({ type: 'EQH', priceLow: low, priceHigh: high, formedAt: 0 });
const eql = (low: number, high: number): SmcZone => ({ type: 'EQL', priceLow: low, priceHigh: high, formedAt: 0 });

// ── Tests ───────────────────────────────────────────────────────────────────

describe('detectLiquiditySweep — guards', () => {
  it('returns not detected when candles5m has < 5 bars', () => {
    const result = detectLiquiditySweep([bar(100, 101, 99, 100)], pad3(bar(100, 101, 99, 100)), signal([eqh(99, 100)]));
    expect(result.detected).toBe(false);
    expect(result.type).toBeNull();
    expect(result.sweptPrice).toBeNull();
  });

  it('returns not detected when candles1m has < 3 bars', () => {
    const result = detectLiquiditySweep(pad5(bar(100, 101, 99, 100)), [bar(100, 101, 99, 100), bar(100, 101, 99, 100)], signal([eqh(99, 100)]));
    expect(result.detected).toBe(false);
  });

  it('returns not detected when signal has no EQH and no EQL zones', () => {
    const last5m = bar(100, 110, 95, 96, 4); // wick high + bearish close
    const last1m = bar(100, 105, 99, 98, 2); // bearish strong body
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([]));
    expect(result.detected).toBe(false);
  });
});

describe('detectLiquiditySweep — BUYSIDE (wick above EQH, close below, bearish 1m)', () => {
  it('detects classic buyside sweep when all conditions are met', () => {
    // 5m: wick to 110, close at 96 (below EQH.priceLow=100)
    const last5m = bar(102, 110, 95, 96, 4);
    // 1m: bearish strong body (open 100, close 96, body=4, range=5 → 0.80 ≥ 0.40)
    const last1m = bar(100, 100.5, 95.5, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(true);
    expect(result.type).toBe('BUYSIDE');
    expect(result.sweptPrice).toBe(102); // eqh.priceHigh
  });

  it('rejects when wick does NOT cross above EQH.priceHigh', () => {
    // wick to 101.5 < eqh.priceHigh=102 → no cross
    const last5m = bar(102, 101.5, 95, 96, 4);
    const last1m = bar(100, 100.5, 95.5, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when close is INSIDE EQH range (no rejection back through zone)', () => {
    // wick 110 above EQH, but close at 101 (between priceLow=100 and priceHigh=102) → breakout, not sweep
    const last5m = bar(99, 110, 99, 101, 4);
    const last1m = bar(100, 102, 99, 101, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when 1m candle is bullish (no bearish rejection)', () => {
    const last5m = bar(102, 110, 95, 96, 4);
    // bullish 1m: open 95, close 96 (close > open) → fails the `close < open` guard
    const last1m = bar(95, 96.5, 94.5, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when 1m body/range ratio is below threshold (0.40 default)', () => {
    const last5m = bar(102, 110, 95, 96, 4);
    // 1m: body=0.2 (open 100, close 99.8), range=2.0 → ratio=0.10 < 0.40
    const last1m = bar(100, 101, 99, 99.8, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when 1m has zero range (degenerate bar)', () => {
    const last5m = bar(102, 110, 95, 96, 4);
    const last1m = bar(100, 100, 100, 100, 2); // high == low → range=0
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102)]));
    expect(result.detected).toBe(false);
  });
});

describe('detectLiquiditySweep — SELLSIDE (wick below EQL, close above, bullish 1m)', () => {
  it('detects classic sellside sweep when all conditions are met', () => {
    // 5m: wick to 90 (below eql.priceLow=95), close at 99 (above eql.priceHigh=97)
    const last5m = bar(96, 100, 90, 99, 4);
    // 1m: bullish strong body (body=3, range=4 → 0.75 ≥ 0.40)
    const last1m = bar(96, 99.5, 95.5, 99, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eql(95, 97)]));
    expect(result.detected).toBe(true);
    expect(result.type).toBe('SELLSIDE');
    expect(result.sweptPrice).toBe(95); // eql.priceLow
  });

  it('rejects when wick does NOT cross below EQL.priceLow', () => {
    // wick to 95.5 > eql.priceLow=95 → no cross
    const last5m = bar(96, 100, 95.5, 99, 4);
    const last1m = bar(96, 99.5, 95.5, 99, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eql(95, 97)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when close is INSIDE EQL range', () => {
    // wick 90 below, close 96 (between priceLow=95 and priceHigh=97) → breakdown, not sweep
    const last5m = bar(97, 100, 90, 96, 4);
    const last1m = bar(95, 97, 94, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eql(95, 97)]));
    expect(result.detected).toBe(false);
  });

  it('rejects when 1m candle is bearish (no bullish reclaim)', () => {
    const last5m = bar(96, 100, 90, 99, 4);
    // bearish 1m: close < open → fails `close > open` guard
    const last1m = bar(99, 99.5, 95.5, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eql(95, 97)]));
    expect(result.detected).toBe(false);
  });
});

describe('detectLiquiditySweep — multi-zone signal', () => {
  it('uses the FIRST EQH found when multiple exist', () => {
    const last5m = bar(102, 110, 95, 96, 4);
    const last1m = bar(100, 100.5, 95.5, 96, 2);
    const zones = [eqh(100, 102), eqh(105, 108)];
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal(zones));
    expect(result.detected).toBe(true);
    expect(result.sweptPrice).toBe(102); // first EQH's priceHigh, not 108
  });

  it('prefers BUYSIDE when both EQH and EQL exist and both qualify', () => {
    // Construct ambiguous: wick both above EQH and below EQL with bearish close
    const last5m = bar(102, 110, 90, 96, 4);
    const last1m = bar(100, 100.5, 95.5, 96, 2);
    const result = detectLiquiditySweep(pad5(last5m), pad3(last1m), signal([eqh(100, 102), eql(95, 97)]));
    // Algorithm checks BUYSIDE first; bearish 1m + close below EQH wins.
    expect(result.detected).toBe(true);
    expect(result.type).toBe('BUYSIDE');
  });
});
