import { describe, it, expect } from 'vitest';
import { computeGoalStatus } from '../goalStatus';

describe('computeGoalStatus', () => {
  it('returns EXCEEDED when progress >= 100%', () => {
    expect(computeGoalStatus(100, 100)).toBe('EXCEEDED');
    expect(computeGoalStatus(150, 100)).toBe('EXCEEDED');
  });

  it('returns ON_TRACK for 70% to 99%', () => {
    expect(computeGoalStatus(70, 100)).toBe('ON_TRACK');
    expect(computeGoalStatus(85, 100)).toBe('ON_TRACK');
    expect(computeGoalStatus(99.99, 100)).toBe('ON_TRACK');
  });

  it('returns BELOW_PACE for 40% to 69.9%', () => {
    expect(computeGoalStatus(40, 100)).toBe('BELOW_PACE');
    expect(computeGoalStatus(55, 100)).toBe('BELOW_PACE');
    expect(computeGoalStatus(69.99, 100)).toBe('BELOW_PACE');
  });

  it('returns WARNING when progress < 40%', () => {
    expect(computeGoalStatus(0, 100)).toBe('WARNING');
    expect(computeGoalStatus(20, 100)).toBe('WARNING');
    expect(computeGoalStatus(39.99, 100)).toBe('WARNING');
  });

  it('returns WARNING for invalid target', () => {
    expect(computeGoalStatus(50, 0)).toBe('WARNING');
    expect(computeGoalStatus(50, -10)).toBe('WARNING');
    expect(computeGoalStatus(50, NaN)).toBe('WARNING');
    expect(computeGoalStatus(50, Infinity)).toBe('WARNING');
  });

  it('handles zero current value', () => {
    expect(computeGoalStatus(0, 1000)).toBe('WARNING');
  });

  it('handles fractional values', () => {
    expect(computeGoalStatus(0.7, 1)).toBe('ON_TRACK');
    expect(computeGoalStatus(0.4, 1)).toBe('BELOW_PACE');
  });
});
