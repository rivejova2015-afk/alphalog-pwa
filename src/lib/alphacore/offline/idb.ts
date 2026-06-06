/**
 * AlphaCore Offline - IndexedDB Helpers
 * 
 * Manages IndexedDB for:
 * - OutboxEntry queue (mutations waiting to sync)
 * - AlphaCore metadata (fingerprints, conflict tracking)
 * 
 * Database: alphalog
 * Stores:
 * - outbox: Queued mutations for offline-first
 * - alphacore_metadata: Dedup fingerprints, conflict history
 */

const DB_NAME = 'alphalog';
const DB_VERSION = 2; // Updated for AlphaCore offline support
const OUTBOX_STORE = 'outbox';
const METADATA_STORE = 'alphacore_metadata';

export interface IDBOutboxEntry {
  id: string; // UUID for outbox entry
  mutationId: string; // Mutation UUID
  operation: 'create' | 'update' | 'delete' | 'restore';
  table: string;
  payload: any;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'synced' | 'failed' | 'conflict';
  lastError?: string;
  fingerprint?: string;
  metadata?: Record<string, any>;
}

export interface IDBMetadata {
  id: string; // Compound key: "${table}:${entityId}:${field}"
  table: string;
  entityId: string;
  field: string; // e.g., "updated_at", "fingerprint"
  value: any;
  timestamp: number;
}

/**
 * Initialize IndexedDB database
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error}`));
    };

    request.onsuccess = () => {
      const db = request.result;
      // Verify stores exist
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        console.warn('[AlphaCore IDB] Outbox store missing - recreate database');
      }
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create outbox store if not exists
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outboxStore = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        outboxStore.createIndex('table', 'table', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
        outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[AlphaCore IDB] Created outbox store');
      }

      // Create metadata store if not exists
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'id' });
        metadataStore.createIndex('table', 'table', { unique: false });
        metadataStore.createIndex('entityId', 'entityId', { unique: false });
        metadataStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('[AlphaCore IDB] Created metadata store');
      }
    };
  });
}

// ============================================================================
// OUTBOX OPERATIONS
// ============================================================================

/**
 * Add entry to outbox queue
 */
export async function addToOutbox(entry: Omit<IDBOutboxEntry, 'id'>): Promise<string> {
  const db = await initDB();
  const id = crypto.randomUUID();
  const outboxEntry: IDBOutboxEntry = { id, ...entry };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.add(outboxEntry);

    request.onerror = () => reject(new Error(`Failed to add to outbox: ${request.error}`));
    request.onsuccess = () => {
      console.log(`[AlphaCore IDB] Added outbox entry: ${id}`);
      resolve(id);
    };
  });
}

/**
 * Get all pending outbox entries
 */
export async function getPendingOutboxEntries(): Promise<IDBOutboxEntry[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onerror = () => reject(new Error(`Failed to get pending entries: ${request.error}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get single outbox entry by ID
 */
export async function getOutboxEntry(id: string): Promise<IDBOutboxEntry | undefined> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.get(id);

    request.onerror = () => reject(new Error(`Failed to get outbox entry: ${request.error}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Update outbox entry status
 */
export async function updateOutboxStatus(
  id: string,
  status: IDBOutboxEntry['status'],
  error?: string
): Promise<void> {
  const db = await initDB();
  const entry = await getOutboxEntry(id);

  if (!entry) {
    throw new Error(`Outbox entry not found: ${id}`);
  }

  const updated: IDBOutboxEntry = {
    ...entry,
    status,
    lastError: error,
    retryCount: status === 'failed' ? entry.retryCount + 1 : entry.retryCount,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.put(updated);

    request.onerror = () => reject(new Error(`Failed to update outbox: ${request.error}`));
    request.onsuccess = () => {
      console.log(`[AlphaCore IDB] Updated outbox ${id}: ${status}`);
      resolve();
    };
  });
}

/**
 * Replace the payload of a pending outbox entry without changing its status
 * or any other metadata.
 *
 * Used when the user edits a row that is still pending (hasn't drained
 * yet). Instead of enqueueing a separate UPDATE that would have to be
 * resolved against the not-yet-existent server id at sync time, we mutate
 * the CREATE payload in place — when it finally drains it carries the
 * latest values directly.
 */
export async function updateOutboxPayload(id: string, payload: unknown): Promise<void> {
  const entry = await getOutboxEntry(id);
  if (!entry) {
    throw new Error(`Outbox entry not found: ${id}`);
  }

  const db = await initDB();
  const updated: IDBOutboxEntry = { ...entry, payload };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.put(updated);

    request.onerror = () => reject(new Error(`Failed to update outbox payload: ${request.error}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Delete outbox entry (after successful sync)
 */
export async function deleteOutboxEntry(id: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(new Error(`Failed to delete outbox: ${request.error}`));
    request.onsuccess = () => {
      console.log(`[AlphaCore IDB] Deleted outbox entry: ${id}`);
      resolve();
    };
  });
}

/**
 * Get outbox entries by status
 */
export async function getOutboxByStatus(
  status: IDBOutboxEntry['status']
): Promise<IDBOutboxEntry[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const index = store.index('status');
    const request = index.getAll(status);

    request.onerror = () => reject(new Error(`Failed to get by status: ${request.error}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get outbox entries for a specific table
 */
export async function getOutboxByTable(table: string): Promise<IDBOutboxEntry[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const index = store.index('table');
    const request = index.getAll(table);

    request.onerror = () => reject(new Error(`Failed to get by table: ${request.error}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Clear entire outbox (after confirming all synced)
 */
export async function clearOutbox(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readwrite');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.clear();

    request.onerror = () => reject(new Error(`Failed to clear outbox: ${request.error}`));
    request.onsuccess = () => {
      console.log('[AlphaCore IDB] Cleared outbox');
      resolve();
    };
  });
}

/**
 * Replace all occurrences of a temp ID with the real server ID across all pending outbox entries.
 * Used after a successful create sync when the server assigns a permanent ID.
 */
export async function replaceTempIdInPendingEntries(tempId: string, realId: string): Promise<number> {
  const db = await initDB();
  const pending = await getPendingOutboxEntries();
  let updated = 0;

  for (const entry of pending) {
    const serialized = JSON.stringify(entry.payload);
    if (!serialized.includes(tempId)) continue;

    const updatedPayload = JSON.parse(serialized.replaceAll(tempId, realId));
    const updatedEntry: IDBOutboxEntry = { ...entry, payload: updatedPayload };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([OUTBOX_STORE], 'readwrite');
      const store = tx.objectStore(OUTBOX_STORE);
      const req = store.put(updatedEntry);
      req.onerror = () => reject(new Error(`Failed to update entry: ${req.error}`));
      req.onsuccess = () => resolve();
    });

    updated++;
  }

  return updated;
}

// ============================================================================
// METADATA OPERATIONS (Dedup Tracking, Conflict History)
// ============================================================================

/**
 * Store metadata (e.g., fingerprints, conflict tracking)
 */
export async function storeMetadata(
  table: string,
  entityId: string,
  field: string,
  value: any
): Promise<void> {
  const db = await initDB();
  const id = `${table}:${entityId}:${field}`;

  const metadata: IDBMetadata = {
    id,
    table,
    entityId,
    field,
    value,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.put(metadata);

    request.onerror = () => reject(new Error(`Failed to store metadata: ${request.error}`));
    request.onsuccess = () => resolve();
  });
}

/**
 * Get metadata by composite key
 */
export async function getMetadata(
  table: string,
  entityId: string,
  field: string
): Promise<any> {
  const db = await initDB();
  const id = `${table}:${entityId}:${field}`;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    const request = store.get(id);

    request.onerror = () => reject(new Error(`Failed to get metadata: ${request.error}`));
    request.onsuccess = () => resolve(request.result?.value);
  });
}

/**
 * Get all metadata for entity
 */
export async function getEntityMetadata(table: string, entityId: string): Promise<IDBMetadata[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readonly');
    const store = transaction.objectStore(METADATA_STORE);
    const index = store.index('entityId');
    const request = index.getAll(entityId);

    request.onerror = () => reject(new Error(`Failed to get entity metadata: ${request.error}`));
    request.onsuccess = () => {
      const results = request.result.filter((m) => m.table === table);
      resolve(results);
    };
  });
}

/**
 * Clear metadata for entity (after successful sync)
 */
export async function clearEntityMetadata(table: string, entityId: string): Promise<void> {
  const db = await initDB();
  const metadata = await getEntityMetadata(table, entityId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([METADATA_STORE], 'readwrite');
    const store = transaction.objectStore(METADATA_STORE);

    metadata.forEach((m) => {
      store.delete(m.id);
    });

    transaction.onerror = () => reject(new Error(`Failed to clear metadata: ${transaction.error}`));
    transaction.oncomplete = () => {
      console.log(`[AlphaCore IDB] Cleared metadata for ${table}:${entityId}`);
      resolve();
    };
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get outbox statistics for UI
 */
export async function getOutboxStats(): Promise<{
  total: number;
  pending: number;
  synced: number;
  failed: number;
  conflicts: number;
  oldestCreatedAt?: number;
}> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Failed to get stats: ${request.error}`));
    request.onsuccess = () => {
      const entries = request.result;
      const stats = {
        total: entries.length,
        pending: entries.filter((e) => e.status === 'pending').length,
        synced: entries.filter((e) => e.status === 'synced').length,
        failed: entries.filter((e) => e.status === 'failed').length,
        conflicts: entries.filter((e) => e.status === 'conflict').length,
        oldestCreatedAt:
          entries.length > 0 ? Math.min(...entries.map((e) => e.createdAt)) : undefined,
      };
      resolve(stats);
    };
  });
}

/**
 * Export outbox for debugging
 */
export async function exportOutbox(): Promise<IDBOutboxEntry[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE], 'readonly');
    const store = transaction.objectStore(OUTBOX_STORE);
    const request = store.getAll();

    request.onerror = () => reject(new Error(`Failed to export: ${request.error}`));
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Clear everything (for testing/reset)
 */
export async function clearAllData(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OUTBOX_STORE, METADATA_STORE], 'readwrite');

    transaction.objectStore(OUTBOX_STORE).clear();
    transaction.objectStore(METADATA_STORE).clear();

    transaction.onerror = () => reject(new Error(`Failed to clear all: ${transaction.error}`));
    transaction.oncomplete = () => {
      console.log('[AlphaCore IDB] Cleared all data');
      resolve();
    };
  });
}
