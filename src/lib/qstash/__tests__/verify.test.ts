import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  verifyJwt,
  verifyQStashSignature,
  _internal_signQStashToken,
} from '../verify';

const SIGNING_KEY = 'test-current-signing-key-must-be-long-enough-for-hmac';
const ALT_KEY = 'test-next-signing-key-equally-long-for-rotation-window';
const URL = 'https://example.com/api/terminal/reports/run-scheduled';

describe('verifyJwt (pure crypto)', () => {
  it('accepts a token signed with the matching key and a clean body hash', () => {
    const body = JSON.stringify({ job_id: 'abc', user_id: 'u1' });
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL);

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(true);
  });

  it('rejects a token signed with a different key', () => {
    const body = '{}';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL);

    expect(verifyJwt(token, ALT_KEY, body, URL)).toBe(false);
  });

  it('rejects when the body was tampered with (body hash mismatch)', () => {
    const originalBody = '{"job_id":"abc"}';
    const token = _internal_signQStashToken(SIGNING_KEY, originalBody, URL);

    // Caller passes a different body than what QStash signed → must fail.
    expect(verifyJwt(token, SIGNING_KEY, '{"job_id":"evil"}', URL)).toBe(false);
  });

  it('rejects when the sub (destination URL) does not match', () => {
    const body = '{}';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL, {
      sub: 'https://attacker.example.com/relay',
    });

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(false);
  });

  it('rejects when iss is not "Upstash"', () => {
    const body = '{}';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL, { iss: 'attacker' });

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(false);
  });

  it('rejects an expired token', () => {
    const body = '{}';
    const expiredExp = Math.floor(Date.now() / 1000) - 60;
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL, { exp: expiredExp });

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(false);
  });

  it('rejects a not-yet-valid token (nbf in the future)', () => {
    const body = '{}';
    const futureNbf = Math.floor(Date.now() / 1000) + 3600;
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL, { nbf: futureNbf });

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(false);
  });

  it('rejects a malformed token (missing parts)', () => {
    expect(verifyJwt('not.a.jwt', SIGNING_KEY, '{}', URL)).toBe(false);
    expect(verifyJwt('only.two', SIGNING_KEY, '{}', URL)).toBe(false);
    expect(verifyJwt('', SIGNING_KEY, '{}', URL)).toBe(false);
  });

  it('accepts a token without a body hash claim (legacy callbacks)', () => {
    // Some older QStash callbacks omit the `body` claim entirely. Our code
    // must accept those — and bodyTampering checks only fire when body is
    // present.
    const body = 'whatever';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL, { body: null });

    expect(verifyJwt(token, SIGNING_KEY, body, URL)).toBe(true);
    // Sanity: bodyHash check only applies when body claim is present.
    expect(verifyJwt(token, SIGNING_KEY, 'anything-else', URL)).toBe(true);
  });

  it('rejects a token whose payload is not valid JSON', async () => {
    // Build a token with garbage in the payload section but a correct HMAC,
    // so the only failure path that fires is the JSON.parse catch.
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const garbagePayload = Buffer.from('not-json-at-all')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const data = `${headerB64}.${garbagePayload}`;
    const { createHmac } = await import('crypto');
    const signature = createHmac('sha256', SIGNING_KEY)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(verifyJwt(`${data}.${signature}`, SIGNING_KEY, '{}', URL)).toBe(false);
  });
});

describe('verifyQStashSignature (env-aware)', () => {
  const originalEnv = {
    current: process.env.QSTASH_CURRENT_SIGNING_KEY,
    next: process.env.QSTASH_NEXT_SIGNING_KEY,
  };

  beforeEach(() => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
  });

  afterEach(() => {
    if (originalEnv.current === undefined) delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    else process.env.QSTASH_CURRENT_SIGNING_KEY = originalEnv.current;
    if (originalEnv.next === undefined) delete process.env.QSTASH_NEXT_SIGNING_KEY;
    else process.env.QSTASH_NEXT_SIGNING_KEY = originalEnv.next;
  });

  it('returns false when no signing keys are configured', () => {
    const body = '{}';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL);

    expect(verifyQStashSignature(token, body, URL)).toBe(false);
  });

  it('accepts a token signed with QSTASH_CURRENT_SIGNING_KEY', () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = SIGNING_KEY;
    const body = '{"job_id":"x"}';
    const token = _internal_signQStashToken(SIGNING_KEY, body, URL);

    expect(verifyQStashSignature(token, body, URL)).toBe(true);
  });

  it('accepts a token signed with QSTASH_NEXT_SIGNING_KEY (rotation window)', () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = SIGNING_KEY;
    process.env.QSTASH_NEXT_SIGNING_KEY = ALT_KEY;
    const body = '{"job_id":"y"}';
    // Signed with the NEXT key — old still in CURRENT slot.
    const token = _internal_signQStashToken(ALT_KEY, body, URL);

    expect(verifyQStashSignature(token, body, URL)).toBe(true);
  });

  it('rejects a token whose signing key is unknown', () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = SIGNING_KEY;
    process.env.QSTASH_NEXT_SIGNING_KEY = ALT_KEY;
    const body = '{}';
    const token = _internal_signQStashToken('attacker-key-not-in-rotation', body, URL);

    expect(verifyQStashSignature(token, body, URL)).toBe(false);
  });
});
