/**
 * Asserts the in-code defaults for the tunables and the capital tier ladder.
 *
 * These guard against accidental regression of the destrabar-trades commit
 * (2026-06-19): MTF threshold lowered, sweep ratio lowered, $20-testing tier
 * inserted. Env vars are inert here because the module is already imported by
 * the test runner; we assert the SHAPE of the exported ladder and the values
 * the test runner sees (which equal the in-code defaults since none of these
 * env vars are set during `npm test`).
 */

import { describe, it, expect } from 'vitest';
import {
  MTF_CONFIDENCE_MIN,
  SWEEP_CONFIRM_BODY_RATIO,
  PD_MACRO_BAND,
  PD_MICRO_BAND,
  PHASES,
} from '../src/core/config.js';

describe('config — tunable defaults', () => {
  it('MTF_CONFIDENCE_MIN = 0.12', () => {
    expect(MTF_CONFIDENCE_MIN).toBe(0.12);
  });

  it('SWEEP_CONFIRM_BODY_RATIO = 0.35', () => {
    expect(SWEEP_CONFIRM_BODY_RATIO).toBe(0.35);
  });

  it('PD_MACRO_BAND/PD_MICRO_BAND unchanged at 0.005', () => {
    expect(PD_MACRO_BAND).toBe(0.005);
    expect(PD_MICRO_BAND).toBe(0.005);
  });
});

describe('config — PHASES ladder', () => {
  it('first tier is $20-testing with riskPct=0.05', () => {
    expect(PHASES[0]).toMatchObject({
      name: '$20-testing',
      capitalMin: 20,
      riskPct: 0.05,
    });
  });

  it('second tier is the legacy $100 entry (riskPct=0.01)', () => {
    expect(PHASES[1]).toMatchObject({
      name: '$100',
      capitalMin: 100,
      riskPct: 0.01,
    });
  });

  it('ladder is sorted by capitalMin ascending', () => {
    for (let i = 1; i < PHASES.length; i++) {
      expect(PHASES[i].capitalMin).toBeGreaterThan(PHASES[i - 1].capitalMin);
    }
  });

  it('riskPct is monotonic non-decreasing once past $20-testing', () => {
    // The $20-testing tier intentionally breaks monotonicity (5% > 1% of $100).
    // After that, the ladder must compound up cleanly.
    for (let i = 2; i < PHASES.length; i++) {
      expect(PHASES[i].riskPct).toBeGreaterThanOrEqual(PHASES[i - 1].riskPct);
    }
  });

  it('top tier remains $5M with 15% risk', () => {
    const top = PHASES[PHASES.length - 1];
    expect(top.name).toBe('$5M');
    expect(top.riskPct).toBe(0.15);
  });
});
