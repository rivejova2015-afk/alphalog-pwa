import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the IDB layer so we can fully control which entries the outbox
// "reads" without touching real IndexedDB (not available in node env).
vi.mock('../idb', () => {
  const state: { entries: any[] } = { entries: [] };
  return {
    __state: state,
    addToOutbox: vi.fn(async (entry: any) => {
      const id = `outbox-${state.entries.length + 1}`;
      state.entries.push({ id, ...entry });
      return id;
    }),
    deleteOutboxEntry: vi.fn(async (id: string) => {
      state.entries = state.entries.filter((e) => e.id !== id);
    }),
    getPendingOutboxEntries: vi.fn(async () =>
      state.entries.filter((e) => e.status === 'pending')
    ),
    getOutboxByStatus: vi.fn(async () => []),
    getOutboxEntry: vi.fn(async (id: string) => state.entries.find((e) => e.id === id)),
    updateOutboxStatus: vi.fn(async (id: string, status: string, lastError?: string) => {
      const entry = state.entries.find((e) => e.id === id);
      if (entry) {
        entry.status = status;
        if (lastError !== undefined) entry.lastError = lastError;
      }
    }),
    getOutboxStats: vi.fn(async () => ({
      total: 0,
      pending: 0,
      synced: 0,
      failed: 0,
      conflicts: 0,
    })),
    replaceTempIdInPendingEntries: vi.fn(async () => undefined),
  };
});

import { OutboxManager } from '../outbox';

// Grab the mocked state so each test can reset it.
import * as idbMock from '../idb';

const STATE = (idbMock as unknown as { __state: { entries: any[] } }).__state;

function resetIdbMock() {
  STATE.entries = [];
  Object.values(idbMock as Record<string, unknown>).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in (fn as object)) {
      (fn as ReturnType<typeof vi.fn>).mockClear();
    }
  });
}

describe('OutboxManager — custom endpoint drain (metadata.endpoint / method / bodyMode)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    resetIdbMock();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as never;
    // Stub the document used to read the CSRF cookie.
    (globalThis as Record<string, unknown>).document = { cookie: 'al_csrf=tok-123' };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).document;
  });

  function newManager() {
    return new OutboxManager({ autoSyncEnabled: false, maxRetries: 1 });
  }

  it('drains to metadata.endpoint with the raw payload when bodyMode is "direct"', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'new-id-1' }),
    });

    const mgr = newManager();
    await mgr.enqueue({
      table: 'journal_entries',
      payload: { text: 'hello', mood: 'good' },
      metadata: {
        id: 'm-1',
        operation: 'create',
        table: 'journal_entries',
        endpoint: '/api/journal',
        method: 'POST',
        bodyMode: 'direct',
      } as never,
    });

    const result = await mgr.syncAll();

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/journal');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    // bodyMode='direct' → raw payload, no { payload, metadata, outboxId } wrapper.
    expect(body).toEqual({ text: 'hello', mood: 'good' });

    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('tok-123');
  });

  it('honors metadata.method (eg. DELETE) when drainging to a custom endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const mgr = newManager();
    await mgr.enqueue({
      table: 'journal_entries',
      payload: { id: 'entry-7' },
      metadata: {
        id: 'm-2',
        operation: 'delete',
        table: 'journal_entries',
        endpoint: '/api/journal',
        method: 'DELETE',
        bodyMode: 'direct',
      } as never,
    });

    await mgr.syncAll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/journal');
    expect((init as RequestInit).method).toBe('DELETE');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ id: 'entry-7' });
  });

  it('falls back to the generic alphacore endpoint when metadata.endpoint is absent', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'new-1' } }),
    });

    const mgr = newManager();
    await mgr.enqueue({
      table: 'journal_entries',
      payload: { text: 'no-custom' },
      metadata: {
        id: 'm-3',
        operation: 'create',
        table: 'journal_entries',
      } as never,
    });

    await mgr.syncAll();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/alphacore/journal_entries/create');
    expect((init as RequestInit).method).toBe('POST');
    const body = JSON.parse((init as RequestInit).body as string);
    // Wrapped shape: { payload, metadata, outboxId }
    expect(body.payload).toEqual({ text: 'no-custom' });
    expect(body.outboxId).toBeDefined();
    expect(body.metadata).toBeDefined();
  });

  it('marks entries as conflict and surfaces the error after maxRetries', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const mgr = newManager();
    await mgr.enqueue({
      table: 'journal_entries',
      payload: { text: 'will-fail' },
      metadata: {
        id: 'm-4',
        operation: 'create',
        table: 'journal_entries',
        endpoint: '/api/journal',
        method: 'POST',
        bodyMode: 'direct',
      } as never,
    });

    const result = await mgr.syncAll();
    expect(result.success).toBe(false);
    expect(result.syncedCount).toBe(0);
    expect(result.conflictCount + result.failedCount).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.error).toMatch(/Failed to fetch/);
  });
});
