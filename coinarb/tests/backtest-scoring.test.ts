import { describe, it, expect } from 'vitest';
import { scoreOutcome, STOP_PCT, TP_PCT, FORWARD_HORIZON_5M_BARS } from '../src/backtest/scoring.js';
import type { Candle } from '../src/analysis/candle-builder.js';

// Helper to build a deterministic 5m bar.
function bar(openTs: number, o: number, h: number, l: number, c: number): Candle {
  return { timeframe: '5M', openTs, closeTs: openTs + 5 * 60_000, open: o, high: h, low: l, close: c, volume: 1 };
}

describe('scoreOutcome (TP/SL/TIMEOUT)', () => {
  const entry = 100;
  const stopBuy   = entry * (1 - STOP_PCT);     // 99.5
  const targetBuy = entry * (1 + TP_PCT);       // 101 (RR_MIN=2)
  const stopSell  = entry * (1 + STOP_PCT);     // 100.5
  const targetSell = entry * (1 - TP_PCT);      // 99

  it('BUY: target hit before stop returns TP', () => {
    const bars: Candle[] = [
      bar(0, 100, 99.9, 99.7, 99.8),
      bar(1, 99.8, 102, 99.8, 101.5),  // high crosses target 101
    ];
    expect(scoreOutcome(bars, 0, 'BUY', entry)).toBe('TP');
  });

  it('BUY: stop hit before target returns SL', () => {
    const bars: Candle[] = [
      bar(0, 100, 100.4, 99.3, 99.4),  // low 99.3 < stop 99.5 → SL
    ];
    expect(scoreOutcome(bars, 0, 'BUY', entry)).toBe('SL');
  });

  it('BUY: intrabar ambiguity (both stop AND target inside same bar) returns SL — pessimistic', () => {
    const bars: Candle[] = [
      bar(0, 100, 102, 99, 100),  // low=99 hits stop, high=102 hits target — must pick SL
    ];
    expect(scoreOutcome(bars, 0, 'BUY', entry)).toBe('SL');
  });

  it('BUY: neither hit within horizon returns TIMEOUT', () => {
    const bars: Candle[] = Array.from({ length: FORWARD_HORIZON_5M_BARS + 1 }, (_, i) =>
      bar(i * 60_000, 100.2, 100.4, 99.7, 100.1),  // tight range, never hits either
    );
    expect(scoreOutcome(bars, 0, 'BUY', entry)).toBe('TIMEOUT');
  });

  it('SELL: target hit (price falls below target) returns TP', () => {
    const bars: Candle[] = [
      bar(0, 100, 100.4, 98.5, 98.9),  // low 98.5 < target 99 → TP
    ];
    expect(scoreOutcome(bars, 0, 'SELL', entry)).toBe('TP');
  });

  it('SELL: stop hit (price rises above stop) returns SL', () => {
    const bars: Candle[] = [
      bar(0, 100, 100.7, 99.9, 100.6),  // high 100.7 > stop 100.5 → SL
    ];
    expect(scoreOutcome(bars, 0, 'SELL', entry)).toBe('SL');
  });

  it('SELL: intrabar ambiguity returns SL — pessimistic', () => {
    const bars: Candle[] = [
      bar(0, 100, 101, 98.8, 99.5),  // high>=stopSell AND low<=targetSell
    ];
    expect(scoreOutcome(bars, 0, 'SELL', entry)).toBe('SL');
  });

  it('respects fromIdx offset (only scans bars from that point forward)', () => {
    const bars: Candle[] = [
      bar(0, 100, 105, 95, 100),       // ignored (before fromIdx)
      bar(1, 100, 100.4, 99.7, 100),   // benign
      bar(2, 100, 102, 99.8, 101.5),   // target hit
    ];
    expect(scoreOutcome(bars, 1, 'BUY', entry)).toBe('TP');
  });

  it('respects FORWARD_HORIZON_5M_BARS limit (won\'t scan past it)', () => {
    const bars: Candle[] = Array.from({ length: FORWARD_HORIZON_5M_BARS + 5 }, (_, i) =>
      i === FORWARD_HORIZON_5M_BARS + 1
        ? bar(i * 60_000, 100, 102, 99.8, 101.5)  // TP hit AFTER horizon
        : bar(i * 60_000, 100.1, 100.3, 99.8, 100.0),
    );
    expect(scoreOutcome(bars, 0, 'BUY', entry)).toBe('TIMEOUT');
  });

  it('constants are derived correctly: TP_PCT = STOP_PCT * RR_MIN', () => {
    expect(TP_PCT).toBeCloseTo(STOP_PCT * 2, 10);
  });
});
