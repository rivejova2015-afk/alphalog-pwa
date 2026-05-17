import { describe, it, expect } from 'vitest';
import {
  applyParameters,
  MTF_CONFIDENCE_MIN,
  PD_MACRO_BAND,
  PD_MICRO_BAND,
  SWEEP_CONFIRM_BODY_RATIO,
  ARB_GAP_MIN_PCT,
} from '../src/core/config.js';

describe('applyParameters', () => {
  it('returns empty changes when called with empty payload', () => {
    const changes = applyParameters({});
    expect(changes).toEqual([]);
  });

  it('mutates mtf_confidence_min and returns the change', () => {
    const newValue = MTF_CONFIDENCE_MIN === 0.42 ? 0.43 : 0.42;
    const changes = applyParameters({ mtf_confidence_min: newValue });
    expect(changes).toEqual([`mtf_confidence_min=${newValue}`]);
    expect(MTF_CONFIDENCE_MIN).toBe(newValue);
  });

  it('mutates pd_macro_band, pd_micro_band, sweep_confirm_body_ratio', () => {
    const orig = { pdMacro: PD_MACRO_BAND, pdMicro: PD_MICRO_BAND, sweep: SWEEP_CONFIRM_BODY_RATIO };
    const target = { pd_macro_band: orig.pdMacro + 0.001, pd_micro_band: orig.pdMicro + 0.001, sweep_confirm_body_ratio: orig.sweep + 0.01 };
    const changes = applyParameters(target);
    expect(changes).toHaveLength(3);
    expect(PD_MACRO_BAND).toBe(target.pd_macro_band);
    expect(PD_MICRO_BAND).toBe(target.pd_micro_band);
    expect(SWEEP_CONFIRM_BODY_RATIO).toBe(target.sweep_confirm_body_ratio);
  });

  it('is a no-op when values already match (returns empty changes)', () => {
    applyParameters({ mtf_confidence_min: 0.25 });
    const changes = applyParameters({ mtf_confidence_min: 0.25 });
    expect(changes).toEqual([]);
  });

  it('mutates arb_gap_min keys in place (preserves object reference)', () => {
    const ref = ARB_GAP_MIN_PCT;
    const changes = applyParameters({ arb_gap_min: { 'BTC-USD': 0.0007 } });
    expect(changes).toContain('arb_gap[BTC-USD]=0.0007');
    expect(ARB_GAP_MIN_PCT['BTC-USD']).toBe(0.0007);
    expect(ARB_GAP_MIN_PCT).toBe(ref);  // same reference, not replaced
  });

  it('ignores non-number values for numeric fields', () => {
    const before = MTF_CONFIDENCE_MIN;
    const changes = applyParameters({ mtf_confidence_min: 'not a number' as unknown as number });
    expect(changes).toEqual([]);
    expect(MTF_CONFIDENCE_MIN).toBe(before);
  });

  it('ignores arb_gap_min entries with zero or negative values', () => {
    const before = ARB_GAP_MIN_PCT['ETH-USD'];
    applyParameters({ arb_gap_min: { 'ETH-USD': 0, 'SOL-USD': -0.001 } });
    expect(ARB_GAP_MIN_PCT['ETH-USD']).toBe(before);
  });

  it('only emits changes for symbols actually in SYMBOLS', () => {
    const changes = applyParameters({ arb_gap_min: { 'DOGE-USD': 0.005 } });
    expect(changes).toEqual([]);  // DOGE not in SYMBOLS, ignored
  });
});
