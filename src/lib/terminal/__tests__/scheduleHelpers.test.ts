import { describe, expect, it } from 'vitest';

import {
  buildCronFromPR,
  normalizeQStashBaseUrl,
  toUtcFromPR,
} from '../scheduleHelpers';

describe('toUtcFromPR', () => {
  it('shifts PR (UTC-4) local time to UTC', () => {
    // 10:00 PR = 14:00 UTC
    const utc = toUtcFromPR('2026-06-15T10:00');
    expect(utc?.toISOString()).toBe('2026-06-15T14:00:00.000Z');
  });

  it('handles end-of-day rollover into the next UTC day', () => {
    // 22:30 PR = 02:30 UTC on the next day
    const utc = toUtcFromPR('2026-06-15T22:30');
    expect(utc?.toISOString()).toBe('2026-06-16T02:30:00.000Z');
  });

  it('handles month/year rollover correctly', () => {
    // 23:00 PR on Dec 31 = 03:00 UTC on Jan 1 of next year
    const utc = toUtcFromPR('2026-12-31T23:00');
    expect(utc?.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('returns null when the input is malformed', () => {
    expect(toUtcFromPR('')).toBeNull();
    expect(toUtcFromPR('not-a-date')).toBeNull();
    expect(toUtcFromPR('2026-06-15')).toBeNull();
    expect(toUtcFromPR('2026-06-15T10')).toBeNull();
    expect(toUtcFromPR('abc-de-fgThi:jk')).toBeNull();
  });

  it('returns null when given non-string input (defensive)', () => {
    expect(toUtcFromPR(undefined as unknown as string)).toBeNull();
    expect(toUtcFromPR(null as unknown as string)).toBeNull();
    expect(toUtcFromPR(123 as unknown as string)).toBeNull();
  });
});

describe('buildCronFromPR', () => {
  it('produces a UTC one-shot cron from a PR datetime', () => {
    // 10:00 PR on Jun 15 → 14:00 UTC on Jun 15
    expect(buildCronFromPR('2026-06-15T10:00')).toBe('0 14 15 6 *');
  });

  it('respects timezone rollover into the next day', () => {
    // 22:30 PR on Jun 15 → 02:30 UTC on Jun 16
    expect(buildCronFromPR('2026-06-15T22:30')).toBe('30 2 16 6 *');
  });

  it('returns null for malformed input', () => {
    expect(buildCronFromPR('not-valid')).toBeNull();
    expect(buildCronFromPR('')).toBeNull();
  });
});

describe('normalizeQStashBaseUrl', () => {
  it('appends /schedules when missing', () => {
    expect(normalizeQStashBaseUrl('https://qstash.upstash.io/v2')).toBe(
      'https://qstash.upstash.io/v2/schedules'
    );
  });

  it('keeps the URL as-is when /schedules is already present', () => {
    expect(normalizeQStashBaseUrl('https://qstash.upstash.io/v2/schedules')).toBe(
      'https://qstash.upstash.io/v2/schedules'
    );
  });

  it('strips a trailing slash before normalization', () => {
    expect(normalizeQStashBaseUrl('https://qstash.upstash.io/v2/')).toBe(
      'https://qstash.upstash.io/v2/schedules'
    );
    expect(normalizeQStashBaseUrl('https://qstash.upstash.io/v2/schedules/')).toBe(
      'https://qstash.upstash.io/v2/schedules'
    );
  });

  it('handles multiple trailing slashes (defensive)', () => {
    expect(normalizeQStashBaseUrl('https://qstash.upstash.io/v2///')).toBe(
      'https://qstash.upstash.io/v2/schedules'
    );
  });
});
