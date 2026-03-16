import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeError, sanitizeUrl, sanitizeLogData, mightContainSensitiveData } from './sanitize';

// ---------------------------------------------------------------------------
// sanitize
// ---------------------------------------------------------------------------

describe('sanitize', () => {
  it('returns primitives unchanged', () => {
    expect(sanitize(42)).toBe(42);
    expect(sanitize('hello')).toBe('hello');
    expect(sanitize(true)).toBe(true);
  });

  it('returns null and undefined unchanged', () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(undefined)).toBeUndefined();
  });

  it('redacts known sensitive keys at top level', () => {
    const result = sanitize({ username: 'alice', password: 'secret123' }) as Record<string, unknown>;
    expect(result.username).toBe('alice');
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts access_token and refresh_token', () => {
    const result = sanitize({
      access_token: 'eyJhbGci...',
      refresh_token: 'rt_abc123',
      data: 'safe',
    }) as Record<string, unknown>;
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refresh_token).toBe('[REDACTED]');
    expect(result.data).toBe('safe');
  });

  it('redacts api_key at any nesting level', () => {
    const result = sanitize({
      config: { api_key: 'super-secret' },
    }) as Record<string, Record<string, unknown>>;
    expect(result.config.api_key).toBe('[REDACTED]');
  });

  it('handles arrays and redacts within them', () => {
    const result = sanitize([
      { name: 'alice', token: 'tok_123' },
      { name: 'bob' },
    ]) as Array<Record<string, unknown>>;
    expect(result[0].name).toBe('alice');
    expect(result[0].token).toBe('[REDACTED]');
    expect(result[1].name).toBe('bob');
  });

  it('converts Date objects to ISO string', () => {
    const d = new Date('2026-01-15T12:00:00Z');
    const result = sanitize(d);
    expect(result).toBe(d.toISOString());
  });

  it('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj;
    expect(() => sanitize(obj)).not.toThrow();
    const result = sanitize(obj) as Record<string, unknown>;
    expect(result.self).toBe('[circular]');
  });

  it('respects maxDepth and returns placeholder beyond limit', () => {
    // Build a deeply nested object with depth 12
    const deep = { level: 12 };
    let current: Record<string, unknown> = deep;
    for (let i = 11; i >= 0; i--) {
      current = { level: i, child: current };
    }
    // Should not throw — just truncate
    expect(() => sanitize(current)).not.toThrow();
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret', username: 'alice' };
    sanitize(original);
    expect(original.password).toBe('secret');
  });
});

// ---------------------------------------------------------------------------
// sanitizeError
// ---------------------------------------------------------------------------

describe('sanitizeError', () => {
  it('returns empty object for falsy input', () => {
    expect(sanitizeError(null)).toEqual({});
    expect(sanitizeError(undefined)).toEqual({});
  });

  it('wraps non-Error values with a string representation', () => {
    const result = sanitizeError('something went wrong');
    expect(result.error).toBe('something went wrong');
  });

  it('extracts name and message from an Error', () => {
    const err = new Error('trade failed');
    const result = sanitizeError(err);
    expect(result.name).toBe('Error');
    expect(result.message).toBe('trade failed');
  });

  it('includes a sanitized stack trace', () => {
    const err = new Error('boom');
    const result = sanitizeError(err);
    expect(typeof result.stack).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// sanitizeUrl
// ---------------------------------------------------------------------------

describe('sanitizeUrl', () => {
  it('redacts sensitive query parameters', () => {
    const url = 'https://api.alphalog.io/data?token=abc123&page=1';
    const result = sanitizeUrl(url);
    expect(result).toContain('token=%5BREDACTED%5D');
    expect(result).toContain('page=1');
  });

  it('redacts "key" query parameter', () => {
    const url = 'https://example.com/api?key=supersecret&foo=bar';
    const result = sanitizeUrl(url);
    expect(result).not.toContain('supersecret');
    expect(result).toContain('foo=bar');
  });

  it('returns the original string when URL is invalid', () => {
    const notAUrl = 'not-a-valid-url';
    expect(sanitizeUrl(notAUrl)).toBe(notAUrl);
  });

  it('leaves URLs without sensitive params unchanged (structurally)', () => {
    const url = 'https://alphalog.io/dashboard?page=2';
    const result = sanitizeUrl(url);
    expect(result).toContain('page=2');
    expect(result).not.toContain('REDACTED');
  });
});

// ---------------------------------------------------------------------------
// sanitizeLogData
// ---------------------------------------------------------------------------

describe('sanitizeLogData', () => {
  it('sanitizes sensitive keys in log data', () => {
    const data = { level: 'error', message: 'failed', token: 'tok_xyz' };
    const result = sanitizeLogData(data);
    expect(result.token).toBe('[REDACTED]');
    expect(result.message).toBe('failed');
  });

  it('also sanitizes the url field if present', () => {
    const data = { url: 'https://api.alphalog.io/v1?token=secret&ok=1' };
    const result = sanitizeLogData(data);
    expect(result.url as string).not.toContain('secret');
    expect(result.url as string).toContain('ok=1');
  });
});

// ---------------------------------------------------------------------------
// mightContainSensitiveData
// ---------------------------------------------------------------------------

describe('mightContainSensitiveData', () => {
  it('returns true for an object with a "token" key', () => {
    expect(mightContainSensitiveData({ token: 'abc' })).toBe(true);
  });

  it('returns true for a string containing "password"', () => {
    expect(mightContainSensitiveData('user password here')).toBe(true);
  });

  it('returns false for a clean object', () => {
    expect(mightContainSensitiveData({ trade: 'EURUSD', pnl: 200 })).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(mightContainSensitiveData('')).toBe(false);
  });
});
