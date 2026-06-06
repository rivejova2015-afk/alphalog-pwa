import { describe, expect, it } from 'vitest';

import {
  PENDING_ID_PREFIX,
  isPendingId,
  outboxIdToPendingId,
  pendingIdToOutboxId,
} from '../pendingIds';

describe('isPendingId', () => {
  it('returns true for ids with the pending: prefix', () => {
    expect(isPendingId('pending:abc-123')).toBe(true);
    expect(isPendingId(`${PENDING_ID_PREFIX}any`)).toBe(true);
  });

  it('returns false for plain server ids (uuids)', () => {
    expect(isPendingId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    expect(isPendingId('1234')).toBe(false);
    expect(isPendingId('')).toBe(false);
  });

  it('returns false for non-string inputs (defensive)', () => {
    expect(isPendingId(undefined as unknown as string)).toBe(false);
    expect(isPendingId(null as unknown as string)).toBe(false);
    expect(isPendingId(42 as unknown as string)).toBe(false);
  });
});

describe('pendingIdToOutboxId', () => {
  it('strips the prefix and returns the raw outbox id', () => {
    expect(pendingIdToOutboxId('pending:abc-123')).toBe('abc-123');
    expect(pendingIdToOutboxId('pending:uuid:with:colons')).toBe('uuid:with:colons');
  });

  it('throws when called with a non-pending id (callers must check first)', () => {
    expect(() => pendingIdToOutboxId('not-pending')).toThrow();
    expect(() => pendingIdToOutboxId('')).toThrow();
  });
});

describe('outboxIdToPendingId', () => {
  it('prefixes a raw outbox id', () => {
    expect(outboxIdToPendingId('abc-123')).toBe('pending:abc-123');
  });

  it('is the inverse of pendingIdToOutboxId', () => {
    const outboxId = 'b6f7-c8d9-aaaa';
    expect(pendingIdToOutboxId(outboxIdToPendingId(outboxId))).toBe(outboxId);
  });
});
