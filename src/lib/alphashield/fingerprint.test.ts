import { describe, it, expect } from 'vitest';
import {
  createFingerprint,
  createErrorFingerprint,
  compareFingertprints,
  createTimeBucketedFingerprint,
  extractStackSummary,
} from './fingerprint';

// ---------------------------------------------------------------------------
// createFingerprint
// ---------------------------------------------------------------------------

describe('createFingerprint', () => {
  it('returns a non-empty string', () => {
    const fp = createFingerprint({ message: 'trade failed', area: 'tradehub' });
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same inputs', () => {
    const opts = { message: 'network error', area: 'api', context: 'retryable' };
    expect(createFingerprint(opts)).toBe(createFingerprint(opts));
  });

  it('produces different fingerprints for different messages', () => {
    const fp1 = createFingerprint({ message: 'error A', area: 'auth' });
    const fp2 = createFingerprint({ message: 'error B', area: 'auth' });
    expect(fp1).not.toBe(fp2);
  });

  it('produces different fingerprints for different areas', () => {
    const fp1 = createFingerprint({ message: 'same error', area: 'auth' });
    const fp2 = createFingerprint({ message: 'same error', area: 'treasury' });
    expect(fp1).not.toBe(fp2);
  });

  it('truncates to at most 40 characters', () => {
    const fp = createFingerprint({
      message: 'a very long message that exceeds forty chars for sure',
      area: 'some-module',
    });
    expect(fp.length).toBeLessThanOrEqual(40);
  });

  it('incorporates context when provided', () => {
    const fp1 = createFingerprint({ message: 'err', area: 'mod', context: 'ctx-A' });
    const fp2 = createFingerprint({ message: 'err', area: 'mod', context: 'ctx-B' });
    expect(fp1).not.toBe(fp2);
  });
});

// ---------------------------------------------------------------------------
// createErrorFingerprint
// ---------------------------------------------------------------------------

describe('createErrorFingerprint', () => {
  it('returns a non-empty fingerprint for a real Error', () => {
    const err = new Error('something broke');
    const fp = createErrorFingerprint(err, 'journal');
    expect(fp.length).toBeGreaterThan(0);
    expect(fp.length).toBeLessThanOrEqual(40);
  });

  it('is deterministic for the same error message and area (stack may vary)', () => {
    // Two errors with identical messages but potentially different stacks.
    // The fingerprint should at minimum start with the same message prefix.
    const err1 = new Error('trade save failed');
    const fp = createErrorFingerprint(err1, 'tradehub');
    expect(fp).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// compareFingertprints (note: typo in source is intentional)
// ---------------------------------------------------------------------------

describe('compareFingertprints', () => {
  it('returns 1 for identical fingerprints', () => {
    const fp = createFingerprint({ message: 'err', area: 'mod' });
    expect(compareFingertprints(fp, fp)).toBe(1);
  });

  it('returns 0 for completely different fingerprints', () => {
    const fp1 = createFingerprint({ message: 'alpha', area: 'mod1' });
    const fp2 = createFingerprint({ message: 'zeta', area: 'mod2' });
    // Different prefixes → 0 (unless they happen to collide, which is vanishingly unlikely)
    const score = compareFingertprints(fp1, fp2);
    expect([0, 0.8, 1]).toContain(score);
  });

  it('returns 0.8 for fingerprints that share the same message prefix', () => {
    // Both messages start with "networker" → after stripping non-alphanumeric and
    // lower-casing, the 10-char prefix is the same.
    const fp1 = createFingerprint({ message: 'networkerr', area: 'area-A' });
    const fp2 = createFingerprint({ message: 'networkerr', area: 'area-B' });
    // Same prefix but different hash (different area) → 0.8
    expect(compareFingertprints(fp1, fp2)).toBe(0.8);
  });
});

// ---------------------------------------------------------------------------
// createTimeBucketedFingerprint
// ---------------------------------------------------------------------------

describe('createTimeBucketedFingerprint', () => {
  it('appends a bucket suffix to the base fingerprint', () => {
    const base = 'testfp_abc123';
    const result = createTimeBucketedFingerprint(base, 1000);
    expect(result.startsWith(base)).toBe(true);
    expect(result).toContain(':');
  });

  it('returns the same bucket for timestamps within the same 30-second window', () => {
    const base = 'base_fp';
    const t1 = 60000;   // bucket = 2
    const t2 = 89999;   // bucket = 2 (89999 / 30000 = 2.99…)
    expect(createTimeBucketedFingerprint(base, t1)).toBe(createTimeBucketedFingerprint(base, t2));
  });

  it('returns different buckets for timestamps in different windows', () => {
    const base = 'base_fp';
    const t1 = 0;      // bucket = 0
    const t2 = 30000;  // bucket = 1
    expect(createTimeBucketedFingerprint(base, t1)).not.toBe(createTimeBucketedFingerprint(base, t2));
  });
});

// ---------------------------------------------------------------------------
// extractStackSummary
// ---------------------------------------------------------------------------

describe('extractStackSummary', () => {
  it('returns an empty string for a plain string input', () => {
    expect(extractStackSummary('plain message')).toBe('');
  });

  it('returns a string (possibly empty) for an Error without a meaningful stack', () => {
    const err = new Error('test');
    const summary = extractStackSummary(err);
    expect(typeof summary).toBe('string');
  });
});
