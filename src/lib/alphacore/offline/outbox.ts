/**
 * AlphaCore Offline - Outbox Queue Manager
 * 
 * Manages mutation queue for offline-first architecture:
 * - Enqueus mutations when offline
 * - Syncs when online with auto-retry
 * - Handles conflicts and errors
 * 
 * Usage:
 *   const outboxMgr = new OutboxManager();
 *   await outboxMgr.enqueue(mutationRequest);
 *   const syncResult = await outboxMgr.syncAll();
 */

import {
  addToOutbox,
  deleteOutboxEntry,
  getPendingOutboxEntries,
  getOutboxByStatus,
  getOutboxEntry,
  updateOutboxStatus,
  getOutboxStats,
  replaceTempIdInPendingEntries,
  type IDBOutboxEntry,
} from './idb';

import type { MutationRequest } from '../mutations';
import { logError, logInfo, logWarn } from '@/lib/log';

/**
 * Outbox sync configuration
 */
export interface OutboxSyncConfig {
  maxRetries?: number; // Default: 3
  retryDelayMs?: number; // Default: 1000 (exponential backoff)
  maxBackoffMs?: number; // Default: 15000 (cap backoff)
  backoffMultiplier?: number; // Default: 2 (exponential factor)
  jitterRatio?: number; // Default: 0.25 (25% jitter)
  autoSyncEnabled?: boolean; // Default: true
  autoSyncIntervalMs?: number; // Default: 30000 (30s)
}

/**
 * Sync result
 */
export interface OutboxSyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  errors: Array<{
    entryId: string;
    error: string;
    retryCount: number;
  }>;
  timestamp: number;
}

/**
 * Outbox Manager
 */
export class OutboxManager {
  private config: Required<OutboxSyncConfig>;
  private autoSyncTimer: NodeJS.Timeout | null = null;

  constructor(config?: OutboxSyncConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelayMs: config?.retryDelayMs ?? 1000,
      maxBackoffMs: config?.maxBackoffMs ?? 15000,
      backoffMultiplier: config?.backoffMultiplier ?? 2,
      jitterRatio: config?.jitterRatio ?? 0.25,
      autoSyncEnabled: config?.autoSyncEnabled ?? true,
      autoSyncIntervalMs: config?.autoSyncIntervalMs ?? 30000,
    };

    // Setup auto-sync listener when online
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onLineRestored());
    }

    // Start auto-sync interval if enabled
    if (this.config.autoSyncEnabled) {
      this.startAutoSync();
    }
  }

  /**
   * Enqueue a mutation for offline execution
   */
  async enqueue(mutation: MutationRequest): Promise<string> {
    const outboxEntry: Omit<IDBOutboxEntry, 'id'> = {
      mutationId: mutation.metadata?.id || crypto.randomUUID(),
      operation: mutation.metadata?.operation || 'create',
      table: mutation.table,
      payload: mutation.payload,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
      fingerprint: mutation.metadata?.fingerprint,
      metadata: mutation.metadata,
    };

    const id = await addToOutbox(outboxEntry);
    logInfo('alphacore.outbox', 'mutation enqueued', { id, table: mutation.table });

    return id;
  }

  /**
   * Sync all pending mutations.
   *
   * Wrapped in a Web Lock so that when the user has the app open in multiple
   * tabs, only one tab drains the outbox at a time. Without this, two tabs
   * coming back online at the same instant would each fetch the same pending
   * entries and POST them twice — duplicate trades / journal entries on the
   * server. The lock is per-origin and the browser releases it when the
   * holder navigates away or its tab is closed. If the API is unavailable
   * (Safari <16, jsdom test env), we fall back to the unguarded path; the
   * race window is real but narrow and recovery is still correct via
   * outbox idempotency.
   */
  async syncAll(): Promise<OutboxSyncResult> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!locks) return this.doSyncAll();
    return locks.request('alphacore-outbox-sync', { mode: 'exclusive' }, () => this.doSyncAll());
  }

  private async doSyncAll(): Promise<OutboxSyncResult> {
    const pendingEntries = await getPendingOutboxEntries();

    if (pendingEntries.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        conflictCount: 0,
        errors: [],
        timestamp: Date.now(),
      };
    }

    logInfo('alphacore.outbox', 'syncAll started', { pending: pendingEntries.length });

    const result: OutboxSyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
      errors: [],
      timestamp: Date.now(),
    };

    // Sync entries in order (respect created_at)
    for (const entry of pendingEntries) {
      const { success, attempts, error } = await this.syncEntryWithBackoff(
        entry,
        entry.maxRetries ?? this.config.maxRetries
      );

      if (success) {
        result.syncedCount++;
        await deleteOutboxEntry(entry.id);
        continue;
      }

      const errorMsg = error ? error.message : 'Unknown error';
      result.failedCount++;
      result.success = false;

      const maxAttempts = entry.maxRetries ?? this.config.maxRetries;
      const exceeded = attempts >= maxAttempts;

      if (exceeded) {
        await updateOutboxStatus(entry.id, 'conflict', `Max retries exceeded: ${errorMsg}`);
        result.conflictCount++;
      } else {
        await updateOutboxStatus(entry.id, 'failed', errorMsg);
      }

      result.errors.push({
        entryId: entry.id,
        error: errorMsg,
        retryCount: attempts,
      });
    }

    logInfo('alphacore.outbox', 'syncAll complete', {
      synced:    result.syncedCount,
      failed:    result.failedCount,
      conflicts: result.conflictCount,
    });

    return result;
  }

  /**
   * Sync a single outbox entry.
   *
   * Two drain modes coexist:
   *   - Generic alphacore endpoint (default): POST/PATCH/DELETE on
   *     /api/alphacore/{table}/{id?}/{op}, body wrapped as
   *     { payload, metadata, outboxId }. Used by mutations enqueued via
   *     getOfflineBridge().mutate(...).
   *   - Custom endpoint (when metadata.endpoint is set): drains to the
   *     domain-specific route (eg. /api/journal) with the raw payload as the
   *     body, exactly as the UI would have sent it online. Used by feature
   *     panels that fall back to the outbox on network errors without
   *     adopting the full alphacore generic endpoint contract.
   */
  private async syncEntry(entry: IDBOutboxEntry): Promise<void> {
    const endpoint = this.buildEndpoint(entry);
    const method = this.buildMethod(entry);
    const useDirectBody = entry.metadata?.bodyMode === 'direct';

    const csrfToken = document.cookie
      .split('; ')
      .find((row) => row.startsWith('al_csrf='))
      ?.split('=')[1] ?? '';

    const body = useDirectBody
      ? entry.payload
      : { payload: entry.payload, metadata: entry.metadata, outboxId: entry.id };

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${response.status}: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    logInfo('alphacore.outbox', 'entry synced', { entryId: entry.id });

    // Update entry metadata with server response (e.g., real ID)
    if (result.data?.id && entry.payload.id?.startsWith('temp_')) {
      const tempId = entry.payload.id as string;
      const realId = result.data.id as string;
      entry.payload.id = realId;
      // Replace temp ID references in all remaining pending entries
      replaceTempIdInPendingEntries(tempId, realId).catch((err) =>
        logWarn('alphacore.outbox', 'failed to replace temp ID refs', { error: String(err) })
      );
    }
  }

  /**
   * Retry a sync with exponential backoff + jitter
   */
  private async syncEntryWithBackoff(entry: IDBOutboxEntry, maxAttempts: number) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.syncEntry(entry);

        if (attempt > 1) {
          logInfo('alphacore.outbox', 'entry succeeded after retries', { entryId: entry.id, attempts: attempt });
        }

        return { success: true as const, attempts: attempt, error: null };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logWarn('alphacore.outbox', 'sync attempt failed', {
          entryId:  entry.id,
          attempt,
          maxAttempts,
          error:    lastError.message,
        });

        const hasAttemptsLeft = attempt < maxAttempts;
        if (!hasAttemptsLeft) {
          break;
        }

        const delay = this.getRetryDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { success: false as const, attempts: maxAttempts, error: lastError };
  }

  /**
   * Calculate retry delay using exponential backoff + jitter
   */
  private getRetryDelay(attempt: number): number {
    const exponential = this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, Math.max(0, attempt - 1));
    const capped = Math.min(exponential, this.config.maxBackoffMs);
    const jitter = capped * this.config.jitterRatio;
    const min = capped - jitter;
    const max = capped + jitter;
    return Math.max(0, Math.random() * (max - min) + min);
  }

  /**
   * Build API endpoint from entry.
   *
   * Honors `metadata.endpoint` when present (custom drain target — usually
   * the same route the online UI uses, so the server-side validation /
   * encryption / audit pipeline runs unchanged). Falls back to the generic
   * alphacore route otherwise.
   */
  private buildEndpoint(entry: IDBOutboxEntry): string {
    const customEndpoint = entry.metadata?.endpoint;
    if (typeof customEndpoint === 'string' && customEndpoint.length > 0) {
      return customEndpoint;
    }

    const base = `/api/alphacore/${entry.table}`;
    switch (entry.operation) {
      case 'create':
        return `${base}/create`;
      case 'update':
      case 'restore':
        return `${base}/${entry.payload.id}/${entry.operation}`;
      case 'delete':
        return `${base}/${entry.payload.id}/delete`;
      default:
        throw new Error(`Unknown operation: ${entry.operation}`);
    }
  }

  /**
   * Build HTTP method from entry.
   *
   * Honors `metadata.method` when present (eg. a custom endpoint that uses
   * DELETE with a body, or PUT instead of PATCH). Falls back to the
   * operation → verb mapping used by the generic alphacore route.
   */
  private buildMethod(entry: IDBOutboxEntry): string {
    const customMethod = entry.metadata?.method;
    if (typeof customMethod === 'string' && customMethod.length > 0) {
      return String(customMethod).toUpperCase();
    }

    switch (entry.operation) {
      case 'create':
        return 'POST';
      case 'update':
      case 'restore':
        return 'PATCH';
      case 'delete':
        return 'DELETE';
      default:
        return 'POST';
    }
  }

  /**
   * Called when connection restored
   */
  private async onLineRestored(): Promise<void> {
    logInfo('alphacore.outbox', 'online restored — triggering sync');
    const result = await this.syncAll();

    if (!result.success) {
      logError('Alphacore', {
        component: 'outbox.onLineRestored',
        message: `Sync after reconnection had ${result.errors?.length ?? 0} errors`,
        errors: result.errors,
      });
    }
  }

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    this.autoSyncTimer = setInterval(async () => {
      const stats = await getOutboxStats();
      if (stats.pending > 0) {
        logInfo('alphacore.outbox', 'auto-sync triggered', { pending: stats.pending });
        await this.syncAll();
      }
    }, this.config.autoSyncIntervalMs);
  }

  /**
   * Stop auto-sync timer
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  /**
   * Get outbox statistics
   */
  async getStats() {
    return getOutboxStats();
  }

  /**
   * Get failed entries (for UI display)
   */
  async getFailedEntries(): Promise<IDBOutboxEntry[]> {
    return getOutboxByStatus('failed');
  }

  /**
   * Get conflicted entries (for UI display)
   */
  async getConflictEntries(): Promise<IDBOutboxEntry[]> {
    return getOutboxByStatus('conflict');
  }

  /**
   * Retry a failed entry
   */
  async retryEntry(entryId: string): Promise<void> {
    const entry = await getOutboxEntry(entryId);

    if (!entry) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const { success, attempts, error } = await this.syncEntryWithBackoff(
      entry,
      entry.maxRetries ?? this.config.maxRetries
    );

    if (success) {
      await deleteOutboxEntry(entryId);
      logInfo('alphacore.outbox', 'entry retried successfully', { entryId });
      return;
    }

    const errorMsg = error ? error.message : 'Unknown error';
    const maxAttempts = entry.maxRetries ?? this.config.maxRetries;
    const exceeded = attempts >= maxAttempts;

    if (exceeded) {
      await updateOutboxStatus(entryId, 'conflict', `Max retries exceeded: ${errorMsg}`);
    } else {
      await updateOutboxStatus(entryId, 'failed', errorMsg);
    }

    throw new Error(errorMsg);
  }

  /**
   * Cancel/delete an outbox entry
   */
  async cancel(entryId: string): Promise<void> {
    await deleteOutboxEntry(entryId);
    logInfo('alphacore.outbox', 'entry cancelled', { entryId });
  }

  /**
   * Resolve conflict by choosing local or server version
   * (Implementation in FASE 7 - conflict resolution)
   */
  async resolveConflict(entryId: string, resolution: 'local' | 'server' | 'merged'): Promise<void> {
    logInfo('alphacore.outbox', 'resolving conflict', { entryId, resolution });

    if (resolution === 'server') {
      // Discard local change — server version wins
      await deleteOutboxEntry(entryId);
      logInfo('alphacore.outbox', 'conflict resolved (discarded local)', { entryId });
      return;
    }

    if (resolution === 'local') {
      // Re-queue with pending status — local version wins, force re-sync
      await updateOutboxStatus(entryId, 'pending', undefined);
      logInfo('alphacore.outbox', 'conflict resolved (re-queued)', { entryId });
      return;
    }

    // 'merged' is not supported without a merge UI — surface the error
    throw new Error('Manual merge not yet supported. Choose "local" or "server".');
  }

  /**
   * Clear all outbox (for testing)
   */
  async clearAll(): Promise<void> {
    const entries = await getPendingOutboxEntries();
    for (const entry of entries) {
      await deleteOutboxEntry(entry.id);
    }
    logInfo('alphacore.outbox', 'cleared all entries', { count: entries.length });
  }
}

/**
 * Global outbox manager instance
 */
let globalOutboxManager: OutboxManager | null = null;

/**
 * Get or create global outbox manager
 */
export function getOutboxManager(config?: OutboxSyncConfig): OutboxManager {
  if (!globalOutboxManager) {
    globalOutboxManager = new OutboxManager(config);
  }
  return globalOutboxManager;
}

/**
 * Reset global outbox manager (for testing)
 */
export function resetOutboxManager(): void {
  if (globalOutboxManager) {
    globalOutboxManager.stopAutoSync();
    globalOutboxManager = null;
  }
}
