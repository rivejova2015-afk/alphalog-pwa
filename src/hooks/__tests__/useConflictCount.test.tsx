/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/alphacore/offline/idb', () => {
  return {
    getOutboxByStatus: vi.fn(),
  };
});

import { getOutboxByStatus } from '@/lib/alphacore/offline/idb';
import { useConflictCount } from '../useConflictCount';

// Real timers throughout — `waitFor` from @testing-library uses setTimeout
// internally, and combining it with vi.useFakeTimers deadlocks both. With
// real timers and millisecond-scale delays the suite still runs in ~1s.

describe('useConflictCount', () => {
  beforeEach(() => {
    vi.mocked(getOutboxByStatus).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reads conflicts from the outbox after the first-poll delay and exposes the count', async () => {
    vi.mocked(getOutboxByStatus).mockResolvedValue([
      { id: 'a' } as never,
      { id: 'b' } as never,
      { id: 'c' } as never,
    ]);

    const { result } = renderHook(() =>
      useConflictCount({ firstPollDelayMs: 20, intervalMs: 60_000 })
    );

    // Before the first poll fires, count is the initial value.
    expect(result.current.count).toBe(0);

    await waitFor(() => expect(result.current.count).toBe(3), { timeout: 1000 });
    expect(getOutboxByStatus).toHaveBeenCalledWith('conflict');
  });

  it('re-polls on the configured interval and tracks count changes', async () => {
    vi.mocked(getOutboxByStatus)
      .mockResolvedValueOnce([{ id: 'a' } as never])
      .mockResolvedValueOnce([{ id: 'a' } as never, { id: 'b' } as never])
      .mockResolvedValue([]);

    const { result } = renderHook(() =>
      useConflictCount({ firstPollDelayMs: 20, intervalMs: 60 })
    );

    await waitFor(() => expect(result.current.count).toBe(1), { timeout: 1000 });
    await waitFor(() => expect(result.current.count).toBe(2), { timeout: 1000 });
    await waitFor(() => expect(result.current.count).toBe(0), { timeout: 1000 });
  });

  it('is inert when disabled — never polls, count stays at 0', async () => {
    vi.mocked(getOutboxByStatus).mockResolvedValue([{ id: 'a' } as never]);

    const { result } = renderHook(() =>
      useConflictCount({ firstPollDelayMs: 20, intervalMs: 60, disabled: true })
    );

    // Wait long enough that polling would have fired several times.
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(result.current.count).toBe(0);
    expect(getOutboxByStatus).not.toHaveBeenCalled();
  });

  it('swallows IDB errors without crashing the hook (count stays at last known value)', async () => {
    vi.mocked(getOutboxByStatus)
      .mockResolvedValueOnce([{ id: 'a' } as never, { id: 'b' } as never])
      .mockRejectedValue(new Error('IDB closed unexpectedly'));

    const { result } = renderHook(() =>
      useConflictCount({ firstPollDelayMs: 20, intervalMs: 60 })
    );

    await waitFor(() => expect(result.current.count).toBe(2), { timeout: 1000 });

    // Give the rejecting poll a chance to fire; the hook must swallow the
    // error so the count holds the previous good value (2), not 0.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(result.current.count).toBe(2);
  });

  it('refresh() forces a re-read on demand', async () => {
    vi.mocked(getOutboxByStatus)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'a' } as never, { id: 'b' } as never, { id: 'c' } as never]);

    const { result } = renderHook(() =>
      useConflictCount({ firstPollDelayMs: 20, intervalMs: 60_000 })
    );

    await waitFor(() => expect(result.current.count).toBe(0), { timeout: 1000 });

    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.count).toBe(3), { timeout: 1000 });
  });
});
