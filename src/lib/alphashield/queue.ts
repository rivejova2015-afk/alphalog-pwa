/**
 * AlphaShield Queue Manager
 * Manages local offline queue of logs using IndexedDB
 *
 * Features:
 * - Persist logs locally when offline
 * - Flush queue when online
 * - Automatic cleanup of sent logs
 * - Max queue size to prevent bloat
 */

/**
 * Queued log entry structure
 */
export interface QueuedLog {
  id: string;
  timestamp: number;
  level: string;
  area: string;
  message: string;
  meta: Record<string, unknown>;
  fingerprint: string;
  url: string;
  user_agent: string;
  sent: boolean;
  sent_at?: number;
  error?: string; // Error message if sending failed
}

const DB_NAME = 'alphashield';
const STORE_NAME = 'logs_queue';
const DB_VERSION = 1;
const MAX_QUEUE_SIZE = 1000;

/**
 * Initialize IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('sent', 'sent', { unique: false });
        store.createIndex('area', 'area', { unique: false });
        store.createIndex('fingerprint', 'fingerprint', { unique: false });
      }
    };
  });
}

/**
 * Add a log to the queue
 */
export async function enqueueLog(log: Omit<QueuedLog, 'id' | 'sent' | 'timestamp'>): Promise<string> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const queuedLog: QueuedLog = {
      ...log,
      id,
      timestamp: Date.now(),
      sent: false,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queuedLog);

      request.onerror = () => {
        reject(new Error('Failed to enqueue log'));
      };

      request.onsuccess = () => {
        // Cleanup old logs if queue is too large
        cleanupOldLogs().catch(console.error);
        resolve(id);
      };
    });
  } catch (error) {
    console.error('Error enqueueing log:', error);
    throw error;
  }
}

/**
 * Get all unsent logs
 */
export async function getUnsentLogs(): Promise<QueuedLog[]> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      // No usamos el indice 'sent' con IDBKeyRange: los booleanos no son
      // claves validas de IndexedDB (DataError: "not a valid key"). Se
      // trae todo y se filtra en memoria -- la cola tiene como maximo
      // MAX_QUEUE_SIZE (1000) entradas, asi que el costo es despreciable.
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error('Failed to get unsent logs'));
      };

      request.onsuccess = () => {
        const logs = request.result as QueuedLog[];
        resolve(logs.filter((log) => !log.sent));
      };
    });
  } catch (error) {
    console.error('Error getting unsent logs:', error);
    return [];
  }
}

/**
 * Mark a log as sent
 */
export async function markLogAsSent(id: string, sentAt: number = Date.now()): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onerror = () => {
        reject(new Error('Failed to mark log as sent'));
      };

      request.onsuccess = () => {
        const log = request.result as QueuedLog;
        if (log) {
          log.sent = true;
          log.sent_at = sentAt;
          const updateRequest = store.put(log);

          updateRequest.onerror = () => {
            reject(new Error('Failed to update log'));
          };

          updateRequest.onsuccess = () => {
            resolve();
          };
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('Error marking log as sent:', error);
    throw error;
  }
}

/**
 * Mark a log with an error
 */
export async function markLogWithError(id: string, error: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(id);

      request.onerror = () => {
        reject(new Error('Failed to mark log with error'));
      };

      request.onsuccess = () => {
        const log = request.result as QueuedLog;
        if (log) {
          log.error = error;
          const updateRequest = store.put(log);

          updateRequest.onerror = () => {
            reject(new Error('Failed to update log'));
          };

          updateRequest.onsuccess = () => {
            resolve();
          };
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('Error marking log with error:', error);
    throw error;
  }
}

/**
 * Delete a log from queue (after successful sync)
 */
export async function deleteLog(id: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onerror = () => {
        reject(new Error('Failed to delete log'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error('Error deleting log:', error);
    throw error;
  }
}

/**
 * Get queue size
 */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.count();

      request.onerror = () => {
        reject(new Error('Failed to count logs'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  } catch (error) {
    console.error('Error getting queue size:', error);
    return 0;
  }
}

/**
 * Clean up old sent logs (keep last 100)
 * Prevents IndexedDB from growing unbounded
 */
async function cleanupOldLogs(): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Count total logs
    const countRequest = store.count();

    return new Promise((resolve, reject) => {
      countRequest.onsuccess = () => {
        const count = countRequest.result;

        if (count > MAX_QUEUE_SIZE) {
          // Delete sent logs first (oldest first). Igual que en
          // getUnsentLogs: sin IDBKeyRange sobre el indice 'sent' (booleano
          // no es una clave valida de IndexedDB), se filtra en memoria.
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const sentLogs = (getAllRequest.result as QueuedLog[]).filter((log) => log.sent);
            const toDelete = sentLogs
              .sort((a, b) => a.timestamp - b.timestamp)
              .slice(0, sentLogs.length - 50); // Keep last 50 sent

            toDelete.forEach(log => {
              store.delete(log.id);
            });

            resolve();
          };

          getAllRequest.onerror = () => {
            reject(new Error('Failed to cleanup logs'));
          };
        } else {
          resolve();
        }
      };

      countRequest.onerror = () => {
        reject(new Error('Failed to count logs'));
      };
    });
  } catch (error) {
    console.error('Error cleaning up logs:', error);
  }
}

/**
 * Clear entire queue (for testing or explicit user action)
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear queue'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error('Error clearing queue:', error);
    throw error;
  }
}

/**
 * Get all logs (sent and unsent) for debugging
 */
export async function getAllLogs(): Promise<QueuedLog[]> {
  try {
    const db = await initDB();
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onerror = () => {
        reject(new Error('Failed to get all logs'));
      };

      request.onsuccess = () => {
        resolve(request.result as QueuedLog[]);
      };
    });
  } catch (error) {
    console.error('Error getting all logs:', error);
    return [];
  }
}
