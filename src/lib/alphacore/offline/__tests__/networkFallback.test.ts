import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapOutbox,
  enqueueOfflineMutation,
  getPendingForTable,
  isNetworkError,
} from '../networkFallback';

vi.mock('../outbox', () => {
  return {
    getOutboxManager: vi.fn(),
  };
});

vi.mock('../idb', () => {
  return {
    getPendingOutboxEntries: vi.fn(),
  };
});

import { getOutboxManager } from '../outbox';
import { getPendingOutboxEntries } from '../idb';

describe('isNetworkError', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  function mockNavigator(onLine: boolean) {
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine },
      configurable: true,
      writable: true,
    });
  }

  it('returns true when navigator.onLine is false (regardless of error shape)', () => {
    mockNavigator(false);
    expect(isNetworkError(new Error('whatever'))).toBe(true);
  });

  it('returns true for Chromium "Failed to fetch" TypeError', () => {
    mockNavigator(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns true for Firefox "NetworkError when attempting to fetch resource."', () => {
    mockNavigator(true);
    expect(
      isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))
    ).toBe(true);
  });

  it('returns true for Safari "Load failed"', () => {
    mockNavigator(true);
    expect(isNetworkError(new TypeError('Load failed'))).toBe(true);
  });

  it('returns true for Node-style "fetch failed" wrappers', () => {
    mockNavigator(true);
    expect(isNetworkError(new Error('fetch failed: ECONNRESET'))).toBe(true);
  });

  it('returns false for AbortError (user cancelled — do NOT queue)', () => {
    mockNavigator(true);
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(isNetworkError(abort)).toBe(false);
  });

  it('returns false for plain Error with non-network message', () => {
    mockNavigator(true);
    expect(isNetworkError(new Error('HTTP 422: validation failed'))).toBe(false);
  });

  it('returns false for non-Error values when online', () => {
    mockNavigator(true);
    expect(isNetworkError('some string')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError({ message: 'oops' })).toBe(false);
  });
});

describe('enqueueOfflineMutation', () => {
  beforeEach(() => {
    vi.mocked(getOutboxManager).mockReset();
  });

  it('forwards endpoint/method/bodyMode metadata to the OutboxManager', async () => {
    const enqueue = vi.fn().mockResolvedValue('outbox-id-42');
    vi.mocked(getOutboxManager).mockReturnValue({ enqueue } as never);

    const id = await enqueueOfflineMutation({
      endpoint: '/api/journal',
      method: 'POST',
      table: 'journal_entries',
      payload: { text: 'hello' },
      operation: 'create',
      fingerprint: 'fp-1',
    });

    expect(id).toBe('outbox-id-42');
    expect(enqueue).toHaveBeenCalledTimes(1);
    const arg = enqueue.mock.calls[0]![0];
    expect(arg.table).toBe('journal_entries');
    expect(arg.payload).toEqual({ text: 'hello' });
    expect(arg.metadata?.endpoint).toBe('/api/journal');
    expect(arg.metadata?.method).toBe('POST');
    expect(arg.metadata?.bodyMode).toBe('direct');
    expect(arg.metadata?.operation).toBe('create');
    expect(arg.metadata?.fingerprint).toBe('fp-1');
  });

  it('defaults operation to "create" when not specified', async () => {
    const enqueue = vi.fn().mockResolvedValue('id');
    vi.mocked(getOutboxManager).mockReturnValue({ enqueue } as never);

    await enqueueOfflineMutation({
      endpoint: '/api/tradehub/trades',
      method: 'POST',
      table: 'trades',
      payload: { symbol: 'XAUUSD' },
    });

    const arg = enqueue.mock.calls[0]![0];
    expect(arg.metadata?.operation).toBe('create');
  });

  it('allows DELETE with a custom endpoint (journal soft-delete drains to /api/journal)', async () => {
    const enqueue = vi.fn().mockResolvedValue('id');
    vi.mocked(getOutboxManager).mockReturnValue({ enqueue } as never);

    await enqueueOfflineMutation({
      endpoint: '/api/journal',
      method: 'DELETE',
      table: 'journal_entries',
      payload: { id: 'entry-1' },
      operation: 'delete',
    });

    const arg = enqueue.mock.calls[0]![0];
    expect(arg.metadata?.method).toBe('DELETE');
    expect(arg.metadata?.operation).toBe('delete');
  });
});

describe('getPendingForTable', () => {
  beforeEach(() => {
    vi.mocked(getPendingOutboxEntries).mockReset();
  });

  it('returns only entries matching the requested table', async () => {
    vi.mocked(getPendingOutboxEntries).mockResolvedValue([
      { id: '1', table: 'journal_entries' } as never,
      { id: '2', table: 'trades' } as never,
      { id: '3', table: 'journal_entries' } as never,
    ]);

    const result = await getPendingForTable('journal_entries');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['1', '3']);
  });

  it('returns empty array when nothing pending', async () => {
    vi.mocked(getPendingOutboxEntries).mockResolvedValue([]);
    const result = await getPendingForTable('trades');
    expect(result).toEqual([]);
  });
});

describe('bootstrapOutbox', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;

  beforeEach(() => {
    vi.mocked(getOutboxManager).mockReset();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  it('calls getOutboxManager() once to initialize the singleton when window exists', () => {
    (globalThis as Record<string, unknown>).window = {};
    vi.mocked(getOutboxManager).mockReturnValue({} as never);
    bootstrapOutbox();
    expect(getOutboxManager).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on the server (window is undefined)', () => {
    delete (globalThis as Record<string, unknown>).window;
    vi.mocked(getOutboxManager).mockReturnValue({} as never);
    bootstrapOutbox();
    expect(getOutboxManager).not.toHaveBeenCalled();
  });
});
