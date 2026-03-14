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
    console.log(`[OutboxManager] Enqueued mutation: ${id}`);

    return id;
  }

  /**
   * Sync all pending mutations
   */
  async syncAll(): Promise<OutboxSyncResult> {
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

    console.log(`[OutboxManager] Syncing ${pendingEntries.length} pending mutations...`);

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

    console.log(
      `[OutboxManager] Sync complete: ${result.syncedCount} synced, ${result.failedCount} failed, ${result.conflictCount} conflicts`
    );

    return result;
  }

  /**
   * Sync a single outbox entry
   */
  private async syncEntry(entry: IDBOutboxEntry): Promise<void> {
    // TODO: Call API endpoint based on table + operation
    // POST /api/alphacore/{table}/create
    // PATCH /api/alphacore/{table}/{id}/update
    // DELETE /api/alphacore/{table}/{id}/delete
    // etc.

    const endpoint = this.buildEndpoint(entry);
    const method = this.buildMethod(entry.operation);

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: entry.payload,
        metadata: entry.metadata,
        outboxId: entry.id, // For idempotency
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`${response.status}: ${errorData.message || response.statusText}`);
    }

    const result = await response.json();
    console.log(`[OutboxManager] Synced entry ${entry.id}`);

    // Update entry metadata with server response (e.g., real ID)
    if (result.data?.id && entry.payload.id?.startsWith('temp_')) {
      const tempId = entry.payload.id as string;
      const realId = result.data.id as string;
      entry.payload.id = realId;
      // Replace temp ID references in all remaining pending entries
      replaceTempIdInPendingEntries(tempId, realId).catch((err) =>
        console.warn('[OutboxManager] Failed to replace temp ID refs:', err)
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
          console.log(`[OutboxManager] Entry ${entry.id} succeeded after ${attempt} attempts`);
        }

        return { success: true as const, attempts: attempt, error: null };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(
          `[OutboxManager] Attempt ${attempt}/${maxAttempts} failed for ${entry.id}: ${lastError.message}`
        );

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
   * Build API endpoint from entry
   */
  private buildEndpoint(entry: IDBOutboxEntry): string {
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
   * Build HTTP method from operation
   */
  private buildMethod(operation: string): string {
    switch (operation) {
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
    console.log('[OutboxManager] Online restored - triggering sync');
    const result = await this.syncAll();

    if (!result.success) {
      console.error('[OutboxManager] Sync after reconnection had errors:', result.errors);
    }
  }

  /**
   * Start auto-sync timer
   */
  private startAutoSync(): void {
    this.autoSyncTimer = setInterval(async () => {
      const stats = await getOutboxStats();
      if (stats.pending > 0) {
        console.log(`[OutboxManager] Auto-sync triggered (${stats.pending} pending)`);
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
      console.log(`[OutboxManager] Retried entry ${entryId} successfully`);
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
    console.log(`[OutboxManager] Cancelled entry ${entryId}`);
  }

  /**
   * Resolve conflict by choosing local or server version
   * (Implementation in FASE 7 - conflict resolution)
   */
  async resolveConflict(entryId: string, resolution: 'local' | 'server' | 'merged'): Promise<void> {
    console.log(`[OutboxManager] Resolving conflict ${entryId}: ${resolution}`);

    if (resolution === 'server') {
      // Discard local change — server version wins
      await deleteOutboxEntry(entryId);
      console.log(`[OutboxManager] Conflict ${entryId} resolved: discarded local change`);
      return;
    }

    if (resolution === 'local') {
      // Re-queue with pending status — local version wins, force re-sync
      await updateOutboxStatus(entryId, 'pending', undefined);
      console.log(`[OutboxManager] Conflict ${entryId} resolved: re-queued for sync`);
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
    console.log('[OutboxManager] Cleared all entries');
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
