import { describe, it, expect } from 'vitest';
import { deriveMilestoneStatusByDate } from '../milestoneStatus';

describe('deriveMilestoneStatusByDate', () => {
  it('returns "upcoming" when current date is before the quarter', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q2', now)).toBe('upcoming');
    expect(deriveMilestoneStatusByDate(2026, 'Q3', now)).toBe('upcoming');
    expect(deriveMilestoneStatusByDate(2026, 'Q4', now)).toBe('upcoming');
    expect(deriveMilestoneStatusByDate(2027, 'Q1', now)).toBe('upcoming');
  });

  it('returns "active" when current date is within the quarter', () => {
    const q1 = new Date('2026-02-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q1', q1)).toBe('active');

    const q2 = new Date('2026-05-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q2', q2)).toBe('active');

    const q3 = new Date('2026-08-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q3', q3)).toBe('active');

    const q4 = new Date('2026-11-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q4', q4)).toBe('active');
  });

  it('returns "completed" when current date is past the quarter', () => {
    const now = new Date('2026-05-15T12:00:00Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q1', now)).toBe('completed');
    expect(deriveMilestoneStatusByDate(2025, 'Q4', now)).toBe('completed');
  });

  it('handles quarter boundaries correctly', () => {
    // Q1 ends at March 31, 23:59:59 UTC
    const lastSecondOfQ1 = new Date('2026-03-31T23:59:58Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q1', lastSecondOfQ1)).toBe('active');

    const firstSecondOfQ2 = new Date('2026-04-01T00:00:01Z');
    expect(deriveMilestoneStatusByDate(2026, 'Q2', firstSecondOfQ2)).toBe('active');
    expect(deriveMilestoneStatusByDate(2026, 'Q1', firstSecondOfQ2)).toBe('completed');
  });
});
