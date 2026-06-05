/**
 * useConflictCount — React hook that polls the AlphaCore outbox for entries
 * stuck in `conflict` status.
 *
 * A conflict appears when an outbox entry exhausts its retry budget against
 * a real server-side error (4xx/5xx) — typically a 409/412 because the
 * server holds a newer version of the row. The OutboxManager does not auto-
 * resolve these; the user has to pick local or server via the conflicts
 * page.
 *
 * The hook is intentionally polling-based (no event bus): the OutboxManager
 * lives in one tab, the conflicts can also originate from background syncs
 * triggered by `online` events, and IndexedDB does not surface a "row
 * changed" event we could subscribe to.
 *
 * The first poll runs after `firstPollDelayMs` (default 1.5s) so the page
 * paint isn't blocked by the IDB open(). Subsequent polls run every
 * `intervalMs`.
 *
 * Returns:
 *   - count: current number of conflicts (0 when none)
 *   - refresh(): force a re-read (used by ConflictsPage right after a resolve)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getOutboxByStatus } from '@/lib/alphacore/offline/idb';

export interface UseConflictCountOptions {
  intervalMs?: number;
  firstPollDelayMs?: number;
  /** When true, the hook is inert (returns 0 and never polls). */
  disabled?: boolean;
}

const DEFAULT_INTERVAL_MS = 8000;
const DEFAULT_FIRST_POLL_DELAY_MS = 1500;

export function useConflictCount(options: UseConflictCountOptions = {}): {
  count: number;
  refresh: () => Promise<void>;
} {
  const { intervalMs = DEFAULT_INTERVAL_MS, firstPollDelayMs = DEFAULT_FIRST_POLL_DELAY_MS, disabled = false } = options;

  const [count, setCount] = useState(0);
  // Keep the latest disabled value in a ref so the polling loop reads the
  // current value without re-binding the interval on every render.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const refresh = useCallback(async () => {
    if (disabledRef.current) return;
    if (typeof window === 'undefined') return;
    try {
      const entries = await getOutboxByStatus('conflict');
      setCount(entries.length);
    } catch {
      // Outbox reads are best-effort — never throw out of a polling hook
      // (a transient IDB error would otherwise crash the badge component).
    }
  }, []);

  useEffect(() => {
    if (disabled) return;
    if (typeof window === 'undefined') return;

    const initialTimeout = window.setTimeout(() => {
      void refresh();
    }, firstPollDelayMs);

    const intervalId = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    // Recheck right after the browser reports it's back online — a sync
    // run that just finished may have generated new conflicts.
    const onOnline = () => {
      window.setTimeout(() => void refresh(), 4000);
    };
    window.addEventListener('online', onOnline);

    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(intervalId);
      window.removeEventListener('online', onOnline);
    };
  }, [disabled, firstPollDelayMs, intervalMs, refresh]);

  return { count, refresh };
}
