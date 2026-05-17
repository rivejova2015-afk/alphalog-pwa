import { describe, it, expect, beforeEach } from 'vitest';
import { setTradingPaused, TRADING_PAUSED } from '../src/core/config.js';

describe('setTradingPaused', () => {
  beforeEach(() => {
    // Ensure clean baseline — TRADING_PAUSED is module-let so isolation matters,
    // but vitest's pool=forks gives us a fresh module graph per file already.
    if (TRADING_PAUSED) setTradingPaused(false);
  });

  it('default state is not paused', () => {
    expect(TRADING_PAUSED).toBe(false);
  });

  it('flips false → true and returns true', () => {
    const flipped = setTradingPaused(true);
    expect(flipped).toBe(true);
    expect(TRADING_PAUSED).toBe(true);
  });

  it('returns false (no-op) when already in target state', () => {
    setTradingPaused(true);
    const flipped = setTradingPaused(true);
    expect(flipped).toBe(false);
    expect(TRADING_PAUSED).toBe(true);
  });

  it('flips true → false and returns true', () => {
    setTradingPaused(true);
    const flipped = setTradingPaused(false);
    expect(flipped).toBe(true);
    expect(TRADING_PAUSED).toBe(false);
  });

  it('multiple toggles work in sequence', () => {
    expect(setTradingPaused(true)).toBe(true);
    expect(setTradingPaused(true)).toBe(false);
    expect(setTradingPaused(false)).toBe(true);
    expect(setTradingPaused(false)).toBe(false);
    expect(TRADING_PAUSED).toBe(false);
  });
});
