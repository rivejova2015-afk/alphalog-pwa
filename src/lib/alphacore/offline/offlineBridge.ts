/**
 * AlphaCore Offline - Bridge Router
 * 
 * Routes mutations to either:
 * 1. API endpoint (online) → immediate response
 * 2. Outbox queue (offline) → enqueue + optimistic update
 * 
 * Provides transparent offline-first interface:
 * - Component calls mutate() → never fails
 * - Online: instant API response
 * - Offline: enqueued + optimistic update
 * - Reconnect: auto-sync
 * 
 * Usage:
 *   const bridge = new OfflineBridge();
 *   const result = await bridge.mutate('accounts', 'create', payload);
 *   // Works both online and offline!
 */

import type { EntityOperation } from '../types';
import type { MutationRequest, MutationResponse } from '../mutations';
import { createEntity, updateEntity, softDeleteEntity } from '../mutations';
import { getOutboxManager } from './outbox';
import { logError } from '@/lib/log';

/**
 * Online/offline detection
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true; // Assume online on server-side
}

export function isOffline(): boolean {
  return !isOnline();
}

/**
 * Session detection
 */
export async function hasSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Check localStorage for auth token
  const token = localStorage.getItem('sb-auth-token') || localStorage.getItem('auth-token');
  if (token) return true;

  // Check cookies
  if (document.cookie.includes('supabase-auth') || document.cookie.includes('auth-token')) {
    return true;
  }

  return false;
}

/**
 * Offline Bridge - routes mutations to API or outbox
 */
export class OfflineBridge {
  private outboxManager = getOutboxManager({
    maxRetries: 3,
    retryDelayMs: 1000,
    autoSyncEnabled: true,
    autoSyncIntervalMs: 30000,
  });

  constructor() {
    // Setup online/offline listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => this.onOfflineDetected());
      window.addEventListener('online', () => this.onOnlineDetected());
    }
  }

  /**
   * Unified mutation interface
   * Works both online and offline
   */
  async mutate<T extends Record<string, any>>(
    table: string,
    operation: EntityOperation,
    payload: Omit<T, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> | T,
    options?: {
      optimisticData?: T;
      onOptimisticApplied?: (data: T) => void;
    }
  ): Promise<MutationResponse<T>> {
    const online = isOnline();

    if (online) {
      // Try online first
      return this.mutateOnline(table, operation, payload as any);
    } else {
      // Offline: enqueue + optimistic update
      return this.mutateOffline(table, operation, payload as any, options);
    }
  }

  /**
   * Online mutation - direct API call
   */
  private async mutateOnline<T extends Record<string, any>>(
    table: string,
    operation: EntityOperation,
    payload: T
  ): Promise<MutationResponse<T>> {
    try {
      let result: MutationResponse<T>;

      if (operation === 'create') {
        result = await createEntity<T>(table, payload, { optimistic: true });
      } else if (operation === 'update') {
        const entityId = (payload as any).id;
        if (!entityId) throw new Error('Update requires id in payload');
        result = await updateEntity<T>(table, entityId, payload as any, { optimistic: true });
      } else if (operation === 'delete') {
        const entityId = (payload as any).id;
        if (!entityId) throw new Error('Delete requires id in payload');
        result = await softDeleteEntity<T>(table, entityId);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }

      console.log(`[OfflineBridge] Online ${operation} completed`, result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError('Alphacore', {
        component: 'offlineBridge.online',
        message: `Online ${operation} failed: ${error.message}`,
        operation,
        table,
      });

      return {
        error: {
          message: error.message,
          originalError: error,
        },
        mutationId: crypto.randomUUID(),
        status: 'failed',
      };
    }
  }

  /**
   * Offline mutation - enqueue + optimistic update
   */
  private async mutateOffline<T extends Record<string, any>>(
    table: string,
    operation: EntityOperation,
    payload: T,
    options?: {
      optimisticData?: T;
      onOptimisticApplied?: (data: T) => void;
    }
  ): Promise<MutationResponse<T>> {
    try {
      const mutationId = crypto.randomUUID();
      const tempId = `temp_${mutationId.slice(0, 8)}`;

      // Create request for outbox
      const request: MutationRequest<T> = {
        table,
        payload: {
          ...payload,
          id: (payload as any).id || tempId,
        },
        metadata: {
          id: mutationId,
          operation,
          table,
          entityName: this.tableToEntityName(table),
          module: this.inferModule(table) as any,
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
        },
      };

      // Enqueue mutation
      const outboxId = await this.outboxManager.enqueue(request);

      // Apply optimistic update in UI
      const optimisticData = options?.optimisticData || {
        ...payload,
        id: (payload as any).id || tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      if (options?.onOptimisticApplied) {
        options.onOptimisticApplied(optimisticData as T);
      }

      console.log(`[OfflineBridge] Offline ${operation} enqueued: ${outboxId}`);

      return {
        data: optimisticData as any,
        mutationId,
        status: 'optimistic',
      } as MutationResponse<T>;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError('Alphacore', {
        component: 'offlineBridge.offline',
        message: `Offline ${operation} failed: ${error.message}`,
        operation,
        table,
      });

      return {
        error: {
          message: error.message,
          originalError: error,
        },
        mutationId: crypto.randomUUID(),
        status: 'failed',
      };
    }
  }

  /**
   * Manual sync trigger
   */
  async syncNow(): Promise<{ success: boolean; synced: number; failed: number; conflicts: number }> {
    const result = await this.outboxManager.syncAll();
    return {
      success: result.success,
      synced: result.syncedCount,
      failed: result.failedCount,
      conflicts: result.conflictCount,
    };
  }

  /**
   * Get outbox status
   */
  async getOutboxStatus() {
    return this.outboxManager.getStats();
  }

  /**
   * Retry a failed entry
   */
  async retryFailed(entryId: string): Promise<void> {
    return this.outboxManager.retryEntry(entryId);
  }

  /**
   * Cancel an outbox entry
   */
  async cancelEntry(entryId: string): Promise<void> {
    return this.outboxManager.cancel(entryId);
  }

  /**
   * Called when offline detected
   */
  private onOfflineDetected(): void {
    console.log('[OfflineBridge] Offline detected - future mutations will be queued');
    // Could dispatch event for UI to show offline banner
  }

  /**
   * Called when online detected
   */
  private onOnlineDetected(): void {
    console.log('[OfflineBridge] Online detected - triggering sync');
    this.syncNow().catch((err) => {
      logError('Alphacore', {
        component: 'offlineBridge.onOnlineDetected',
        message: `Auto-sync after reconnection failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  }

  /**
   * Utility: infer module from table
   */
  private inferModule(table: string): string {
    const moduleMap: Record<string, string> = {
      logs: 'logs',
      categories: 'logs',
      accounts: 'tradehub',
      account_categories: 'tradehub',
      trades: 'tradehub',
      setups: 'tradehub',
      instruments: 'terminal',
      terminal_news: 'terminal',
      journal_entries: 'journal',
      traders: 'tradermap',
      treasury_configs: 'treasury',
      payouts: 'treasury',
      business_costs: 'business',
    };
    return moduleMap[table] || 'unknown';
  }

  /**
   * Utility: convert table to entity name
   */
  private tableToEntityName(table: string): string {
    const map: Record<string, string> = {
      logs: 'Log',
      categories: 'Category',
      accounts: 'Account',
      trades: 'Trade',
      instruments: 'Instrument',
      terminal_news: 'TerminalNews',
      journal_entries: 'JournalEntry',
      traders: 'Trader',
      treasury_configs: 'TreasuryConfig',
      payouts: 'Payout',
      business_costs: 'BusinessCost',
    };
    return map[table] || 'Entity';
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.outboxManager.stopAutoSync();
  }
}

/**
 * Global bridge instance
 */
let globalBridge: OfflineBridge | null = null;

/**
 * Get or create global offline bridge
 */
export function getOfflineBridge(): OfflineBridge {
  if (typeof window === 'undefined') {
    throw new Error('OfflineBridge requires browser environment');
  }

  if (!globalBridge) {
    globalBridge = new OfflineBridge();
  }

  return globalBridge;
}

/**
 * Convenience function for mutations
 */
export async function mutateOfflineFirst<T extends Record<string, any>>(
  table: string,
  operation: EntityOperation,
  payload: T,
  options?: {
    optimisticData?: T;
    onOptimisticApplied?: (data: T) => void;
  }
): Promise<MutationResponse<T>> {
  const bridge = getOfflineBridge();
  return bridge.mutate(table, operation, payload, options);
}
