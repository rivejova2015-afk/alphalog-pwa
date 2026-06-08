/**
 * AlphaCore Offline — Network Fallback Helpers
 *
 * Bridges feature panels (Journal, TradeHub, etc.) that use plain `fetch()`
 * with the offline OutboxManager. When a POST/PATCH/DELETE fails because the
 * device lost connectivity (no `4xx/5xx` from the server — just a TCP/DNS
 * failure), the caller can enqueue the mutation here so it drains
 * automatically when the browser comes back online.
 *
 * Key design choices:
 *   - We do NOT migrate the UI to the generic alphacore endpoint. The drain
 *     target is the same domain-specific route the UI already uses (eg.
 *     `/api/journal`). That way the server-side validation, AES encryption,
 *     audit logging and contract guards all run unchanged — the offline
 *     path is byte-for-byte equivalent to the online one.
 *   - `isNetworkError()` only returns true for transport-level failures.
 *     A 4xx response means the payload is invalid; queueing it would just
 *     fail again at sync time.
 *   - Bootstrap happens once at app load (see CsrfBridge) so the
 *     OutboxManager listens to `window.online` and auto-syncs without any
 *     panel having to wire it up.
 */

import type { OutboxManager } from './outbox';
import { getOutboxManager } from './outbox';
import type { IDBOutboxEntry } from './idb';
import { getPendingOutboxEntries } from './idb';

type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface OfflineEnqueueOptions {
  /** The route the OutboxManager should POST/PATCH/DELETE to on reconnect. */
  endpoint: string;
  /** HTTP verb to use. */
  method: HttpMethod;
  /** Logical table name (eg. `journal_entries`). Used for filtering UI views. */
  table: string;
  /** The exact body the UI would have sent online — drained verbatim. */
  payload: Record<string, unknown>;
  /** Logical operation (drives the operation field on the outbox entry). */
  operation?: 'create' | 'update' | 'delete' | 'restore';
  /**
   * Stable fingerprint to suppress accidental duplicates on rapid retries.
   * Optional — defaults to undefined so each enqueue is a fresh row.
   */
  fingerprint?: string;
}

const DEFAULT_OPERATION: NonNullable<OfflineEnqueueOptions['operation']> = 'create';

/**
 * Classify a fetch failure as a transport-level error.
 *
 *   - `!navigator.onLine` — the browser knows the radio is off.
 *   - `TypeError: Failed to fetch` (Chromium) / `NetworkError when ...`
 *     (Firefox) / `Load failed` (Safari).
 *   - Node-style `ECONNRESET` / `fetch failed` if the caller proxies through
 *     a server-side fetcher.
 *
 * `AbortError` is intentionally NOT treated as network — the user cancelled,
 * we should not silently queue.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!(err instanceof Error)) return false;
  if (err.name === 'AbortError') return false;
  const message = err.message || '';
  return /failed to fetch|networkerror|load failed|econnreset|fetch failed|network request failed/i.test(message);
}

/**
 * Enqueue a mutation that failed online due to a network error.
 * Returns the outbox entry id so the UI can render an optimistic row keyed
 * to it (and remove it on success).
 */
export async function enqueueOfflineMutation(
  opts: OfflineEnqueueOptions,
  manager: OutboxManager = getOutboxManager()
): Promise<string> {
  return manager.enqueue({
    table: opts.table,
    payload: opts.payload,
    metadata: {
      endpoint: opts.endpoint,
      method: opts.method,
      bodyMode: 'direct',
      operation: opts.operation ?? DEFAULT_OPERATION,
      fingerprint: opts.fingerprint,
    },
  });
}

/**
 * Read all pending outbox entries for a given logical table. Useful for
 * panels that want to render optimistic rows ("⏳ Syncing…") alongside
 * server-fetched data.
 */
export async function getPendingForTable(table: string): Promise<IDBOutboxEntry[]> {
  const entries = await getPendingOutboxEntries();
  return entries.filter((entry) => entry.table === table);
}

/**
 * Ensure the OutboxManager is initialized in the browser. Safe to call
 * multiple times — `getOutboxManager` memoizes a singleton.
 *
 * Calling this once on app boot guarantees:
 *   - `window.addEventListener('online', ...)` is wired
 *   - The autoSync interval (default 30s) is running
 *
 * Without this, mutations enqueued by feature panels would only sync if
 * the panel itself constructed an OutboxManager — wasted instances and
 * inconsistent behavior between routes.
 */
export function bootstrapOutbox(): void {
  if (typeof window === 'undefined') return;
  getOutboxManager();
}
