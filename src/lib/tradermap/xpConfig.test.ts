import { describe, it, expect } from 'vitest';
import { XP_VALUES } from './xpConfig';

describe('XP_VALUES', () => {
  it('trade_complete is 10 XP', () => {
    expect(XP_VALUES.trade_complete).toBe(10);
  });

  it('goal_complete is 500 XP', () => {
    expect(XP_VALUES.goal_complete).toBe(500);
  });

  it('goal_complete is significantly higher than trade_complete', () => {
    expect(XP_VALUES.goal_complete).toBeGreaterThan(XP_VALUES.trade_complete * 10);
  });

  it('all values are positive integers', () => {
    for (const [key, value] of Object.entries(XP_VALUES)) {
      expect(value, `XP_VALUES.${key} should be a positive integer`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `XP_VALUES.${key} should be an integer`).toBe(true);
    }
  });
});
