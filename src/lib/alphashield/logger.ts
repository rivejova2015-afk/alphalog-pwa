/**
 * AlphaShield Logger
 * Main logging utility for client-side error and event logging
 *
 * Features:
 * - Captures errors and events (client-side)
 * - Offline queue with IndexedDB
 * - Automatic deduplication (fingerprinting)
 * - Rate limiting (max 10 events/min per area)
 * - Sanitization (no tokens/keys/secrets)
 * - Auto-flush when online
 */

import { sanitize, sanitizeError, sanitizeLogData, sanitizeUrl } from './sanitize';
import {
  createFingerprint,
  createErrorFingerprint,
  createTimeBucketedFingerprint,
} from './fingerprint';
import {
  enqueueLog,
  getUnsentLogs,
  markLogAsSent,
  markLogWithError,
  getQueueSize,
} from './queue';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger options
 */
export interface LoggerOptions {
  level?: LogLevel;
  area: string;
  message: string;
  meta?: Record<string, unknown>;
  error?: Error;
  url?: string;
}

/**
 * Rate limiting state
 * Tracks event counts per minute per area
 */
interface RateLimitState {
  [area: string]: {
    count: number;
    resetAt: number;
  };
}

/**
 * Deduplication cache
 * Tracks recent fingerprints to prevent duplicates
 */
interface DedupeCache {
  [fingerprint: string]: number; // timestamp
}

/**
 * AlphaShield Logger Class
 */
class AlphaShieldLogger {
  private static instance: AlphaShieldLogger;
  private rateLimitState: RateLimitState = {};
  private dedupeCache: DedupeCache = {};
  private maxRatePerMinute = 10;
  private dedupWindowMs = 30000; // 30 seconds
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isFlushing = false;
  private safeModeCallbacks: ((level: string) => void)[] = [];

  private constructor() {
    this.initOnlineListener();
    this.startAutoFlush();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AlphaShieldLogger {
    if (!AlphaShieldLogger.instance) {
      AlphaShieldLogger.instance = new AlphaShieldLogger();
    }
    return AlphaShieldLogger.instance;
  }

  /**
   * Initialize online/offline listener
   */
  private initOnlineListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flush().catch(console.error);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Start auto-flush interval (every 5 seconds if online)
   */
  private startAutoFlush(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      if (this.isOnline && !this.isFlushing) {
        this.flush().catch(console.error);
      }
    }, 5000);
  }

  /**
   * Check if log exceeds rate limit
   */
  private checkRateLimit(area: string): boolean {
    const now = Date.now();
    const state = this.rateLimitState[area];

    if (!state || now > state.resetAt) {
      // Reset counter
      this.rateLimitState[area] = {
        count: 0,
        resetAt: now + 60000, // 1 minute window
      };
    }

    if (state.count >= this.maxRatePerMinute) {
      return false; // Rate limited
    }

    state.count++;
    return true;
  }

  /**
   * Check if log is a duplicate (within dedupe window)
   */
  private isDuplicate(fingerprint: string): boolean {
    const cached = this.dedupeCache[fingerprint];
    const now = Date.now();

    if (!cached || now - cached > this.dedupWindowMs) {
      this.dedupeCache[fingerprint] = now;
      return false;
    }

    return true;
  }

  /**
   * Cleanup old dedup entries (memory management)
   */
  private cleanupDedupeCache(): void {
    const now = Date.now();
    const cutoff = now - this.dedupWindowMs * 2;

    for (const [fp, timestamp] of Object.entries(this.dedupeCache)) {
      if (timestamp < cutoff) {
        delete this.dedupeCache[fp];
      }
    }
  }

  /**
   * Main log function
   */
  async log(options: LoggerOptions): Promise<void> {
    const {
      level = 'info',
      area,
      message,
      meta = {},
      error,
      url = typeof window !== 'undefined' ? window.location.href : '',
    } = options;

    try {
      // Validate inputs
      if (!area || !message) {
        console.warn('Logger: missing area or message');
        return;
      }

      // Check rate limit
      if (!this.checkRateLimit(area)) {
        console.debug(`Logger: rate limited for area '${area}'`);
        return;
      }

      // Create fingerprint for deduplication
      const fingerprint = error
        ? createErrorFingerprint(error, area)
        : createFingerprint({ message, area });

      // Check for duplicates
      if (this.isDuplicate(fingerprint)) {
        console.debug(`Logger: duplicate log fingerprint '${fingerprint}'`);
        return;
      }

      // Sanitize data
      const sanitizedMeta = sanitizeLogData(meta);
      const sanitizedUrl = sanitizeUrl(url);
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      // Build log object for storage
      const logObject = {
        level,
        area,
        message,
        meta: sanitizedMeta,
        fingerprint,
        url: sanitizedUrl,
        user_agent: userAgent,
      };

      // If error provided, add error details
      if (error) {
        logObject.meta = {
          ...logObject.meta,
          error: sanitizeError(error),
        };
      }

      // Enqueue log to local storage
      await enqueueLog(logObject);

      // Notify safe mode callbacks (for error loop detection)
      this.safeModeCallbacks.forEach(cb => {
        try {
          cb(level);
        } catch (err) {
          console.error('Error in safe mode callback:', err);
        }
      });

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${level.toUpperCase()}] [${area}] ${message}`, meta);
      }

      // Try to flush if online
      if (this.isOnline) {
        this.flush().catch(console.error);
      }
    } catch (err) {
      console.error('Logger: error logging message', err);
    }

    // Cleanup cache periodically
    if (Math.random() < 0.1) {
      this.cleanupDedupeCache();
    }
  }

  /**
   * Log error
   */
  async error(area: string, message: string, error?: Error, meta?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'error',
      area,
      message,
      error,
      meta,
    });
  }

  /**
   * Log warning
   */
  async warn(area: string, message: string, meta?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'warn',
      area,
      message,
      meta,
    });
  }

  /**
   * Log info
   */
  async info(area: string, message: string, meta?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'info',
      area,
      message,
      meta,
    });
  }

  /**
   * Log debug
   */
  async debug(area: string, message: string, meta?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'debug',
      area,
      message,
      meta,
    });
  }

  /**
   * Flush unsent logs to server
   */
  async flush(): Promise<void> {
    if (this.isFlushing) return;

    this.isFlushing = true;

    try {
      const unsentLogs = await getUnsentLogs();

      if (unsentLogs.length === 0) {
        return;
      }

      // Send to /api/logs/ingest
      const response = await fetch('/api/logs/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: unsentLogs,
        }),
      });

      if (response.ok) {
        // Mark all logs as sent
        for (const log of unsentLogs) {
          await markLogAsSent(log.id);
        }
      } else {
        // Mark with error
        const error = `HTTP ${response.status}`;
        for (const log of unsentLogs) {
          await markLogWithError(log.id, error);
        }
      }
    } catch (error) {
      console.error('Logger: error flushing logs', error);
      // Logs remain in queue for retry
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get current queue size
   */
  async getQueueSize(): Promise<number> {
    return getQueueSize();
  }

  /**
   * Set rate limit per minute (for testing)
   */
  setRateLimit(perMinute: number): void {
    this.maxRatePerMinute = perMinute;
  }

  /**
   * Set dedup window (for testing)
   */
  setDedupWindow(windowMs: number): void {
    this.dedupWindowMs = windowMs;
  }

  /**
   * Register safe mode callback (for error loop detection)
   */
  registerSafeModeCallback(callback: (level: string) => void): void {
    this.safeModeCallbacks.push(callback);
  }
}

/**
 * Export singleton instance
 */
export const logger = AlphaShieldLogger.getInstance();

/**
 * Convenience export of getInstance
 */
export { AlphaShieldLogger };
