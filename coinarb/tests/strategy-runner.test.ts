import { describe, it, expect } from 'vitest';
import {
  StrategyRunner,
  shouldSkipForMtfBias,
  shouldSkipForGlobalCaps,
  shouldEvaluateLiquiditySweep,
} from '../src/core/strategy-runner.js';

describe('StrategyRunner', () => {
  it('carries id and mode through the constructor', () => {
    const a = new StrategyRunner({ id: 'A', mode: 'smc' });
    const b = new StrategyRunner({ id: 'B', mode: 'aggressive' });
    expect(a.id).toBe('A');
    expect(a.mode).toBe('smc');
    expect(b.id).toBe('B');
    expect(b.mode).toBe('aggressive');
  });

  it('initializes independent circuit-breaker and daily-tracker instances', () => {
    const a = new StrategyRunner({ id: 'A', mode: 'smc' });
    const b = new StrategyRunner({ id: 'B', mode: 'aggressive' });
    expect(a.circuitBreaker).not.toBe(b.circuitBreaker);
    expect(a.dailyTracker).not.toBe(b.dailyTracker);
  });
});

describe('shouldSkipForMtfBias', () => {
  it('smc mode: NEUTRAL bias skips', () => {
    expect(shouldSkipForMtfBias('smc', 'NEUTRAL', 0.50, 0.12)).toBe(true);
  });

  it('smc mode: confidence below floor skips even on BUY', () => {
    expect(shouldSkipForMtfBias('smc', 'BUY', 0.10, 0.12)).toBe(true);
  });

  it('smc mode: confidence at or above floor accepts BUY', () => {
    expect(shouldSkipForMtfBias('smc', 'BUY', 0.12, 0.12)).toBe(false);
    expect(shouldSkipForMtfBias('smc', 'SELL', 0.25, 0.12)).toBe(false);
  });

  it('aggressive mode: confidence below floor still ACCEPTS BUY/SELL', () => {
    expect(shouldSkipForMtfBias('aggressive', 'BUY', 0.05, 0.12)).toBe(false);
    expect(shouldSkipForMtfBias('aggressive', 'SELL', 0.0, 0.12)).toBe(false);
  });

  it('aggressive mode: NEUTRAL still skips (only bias filters)', () => {
    expect(shouldSkipForMtfBias('aggressive', 'NEUTRAL', 0.99, 0.12)).toBe(true);
  });
});

describe('shouldSkipForGlobalCaps', () => {
  it('returns skip=false when both counts are below caps', () => {
    expect(shouldSkipForGlobalCaps(0, 0, 100, 33)).toEqual({ skip: false });
    expect(shouldSkipForGlobalCaps(99, 32, 100, 33)).toEqual({ skip: false });
  });

  it('skips on global-daily when total >= cap', () => {
    expect(shouldSkipForGlobalCaps(100, 0, 100, 33)).toEqual({
      skip: true, reason: 'global-daily',
    });
    expect(shouldSkipForGlobalCaps(150, 5, 100, 33)).toEqual({
      skip: true, reason: 'global-daily',
    });
  });

  it('skips on global-symbol when per-symbol >= cap and total is fine', () => {
    expect(shouldSkipForGlobalCaps(50, 33, 100, 33)).toEqual({
      skip: true, reason: 'global-symbol',
    });
  });

  it('prioritizes the daily cap over the symbol cap when both trip', () => {
    expect(shouldSkipForGlobalCaps(100, 33, 100, 33)).toEqual({
      skip: true, reason: 'global-daily',
    });
  });
});

describe('shouldEvaluateLiquiditySweep', () => {
  it('smc mode evaluates the sweep gate', () => {
    expect(shouldEvaluateLiquiditySweep('smc')).toBe(true);
  });

  it('aggressive mode bypasses the sweep gate', () => {
    expect(shouldEvaluateLiquiditySweep('aggressive')).toBe(false);
  });
});
