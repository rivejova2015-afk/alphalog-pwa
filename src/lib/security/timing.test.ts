import { describe, it, expect } from 'vitest';
import { timingSafeEqual } from 'crypto';

/**
 * Tests for the timing-safe comparison pattern used in:
 * - /api/push/notify-user (INTERNAL_API_SECRET)
 * - /api/cron/business/alerts (CRON_SECRET)
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

describe('safeCompare (timingSafeEqual pattern)', () => {
  it('returns true for equal strings', () => {
    expect(safeCompare('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(safeCompare('secret123', 'secret456')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(safeCompare('short', 'muchlonger')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(safeCompare('', 'token')).toBe(false);
  });

  it('returns true for empty vs empty', () => {
    expect(safeCompare('', '')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(safeCompare('Secret', 'secret')).toBe(false);
  });

  it('handles long hex tokens (like INTERNAL_API_SECRET)', () => {
    const token = 'a'.repeat(64);
    expect(safeCompare(token, token)).toBe(true);
    expect(safeCompare(token, 'b'.repeat(64))).toBe(false);
  });
});
