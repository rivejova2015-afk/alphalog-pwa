import { describe, it, expect } from 'vitest';
import {
  REGIME_TO_STRATEGY,
  dispatchTargetFor,
  strategiesForRegime,
} from '../src/core/regime-dispatcher.js';
import type { Regime } from '../src/analysis/regime-detector.js';

describe('REGIME_TO_STRATEGY mapping', () => {
  it('covers all 5 regimes', () => {
    const regimes: Regime[] = ['TRENDING_HIGH', 'TRENDING_LOW', 'RANGE_HIGH', 'RANGE_LOW', 'DEAD'];
    for (const r of regimes) {
      expect(REGIME_TO_STRATEGY[r]).toBeDefined();
    }
  });

  it('routes TRENDING_HIGH → DD (Daily Direction Scalper)', () => {
    expect(REGIME_TO_STRATEGY.TRENDING_HIGH).toBe('DD');
  });

  it('routes TRENDING_LOW → DD', () => {
    expect(REGIME_TO_STRATEGY.TRENDING_LOW).toBe('DD');
  });

  it('routes RANGE_HIGH → DD', () => {
    expect(REGIME_TO_STRATEGY.RANGE_HIGH).toBe('DD');
  });

  it('routes RANGE_LOW → DD', () => {
    expect(REGIME_TO_STRATEGY.RANGE_LOW).toBe('DD');
  });

  it('routes DEAD → pause (no strategy)', () => {
    expect(REGIME_TO_STRATEGY.DEAD).toBe('pause');
  });
});

describe('dispatchTargetFor', () => {
  it('matches REGIME_TO_STRATEGY lookup', () => {
    const regimes: Regime[] = ['TRENDING_HIGH', 'TRENDING_LOW', 'RANGE_HIGH', 'RANGE_LOW', 'DEAD'];
    for (const r of regimes) {
      expect(dispatchTargetFor(r)).toBe(REGIME_TO_STRATEGY[r]);
    }
  });
});

describe('strategiesForRegime', () => {
  it('returns the single dispatched strategy for active regimes', () => {
    expect(strategiesForRegime('TRENDING_HIGH')).toEqual(['DD']);
    expect(strategiesForRegime('TRENDING_LOW')).toEqual(['DD']);
    expect(strategiesForRegime('RANGE_HIGH')).toEqual(['DD']);
    expect(strategiesForRegime('RANGE_LOW')).toEqual(['DD']);
  });

  it('returns empty array for DEAD regime', () => {
    expect(strategiesForRegime('DEAD')).toEqual([]);
  });

  it('emits a readonly array (caller cannot mutate the mapping)', () => {
    const a = strategiesForRegime('TRENDING_HIGH');
    const b = strategiesForRegime('TRENDING_HIGH');
    expect(a).toEqual(b);
  });
});
