/**
 * AlphaShield Fingerprinting Utility
 * Creates unique identifiers for logs to detect duplicates
 *
 * Used for deduplication: if same fingerprint appears within 30 seconds,
 * the log is likely a duplicate and should be ignored
 */

/**
 * Generate a simple hash from a string
 * Uses a variant of djb2 algorithm for speed and reasonable distribution
 *
 * @param str - String to hash
 * @returns Hex hash string
 */
function simpleHash(str: string): string {
  let hash = 5381;
  let i = str.length;

  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  // Return positive 32-bit integer as hex
  return (hash >>> 0).toString(16);
}

/**
 * Extract stack trace information
 * Gets the top few function names from an Error stack
 *
 * @param error - Error object (optional)
 * @returns Stack trace summary string
 */
function getStackSummary(error?: Error): string {
  if (!error?.stack) {
    return '';
  }

  // Split stack into lines and take first 3 meaningful lines (skip "Error:" line)
  const lines = error.stack
    .split('\n')
    .slice(1, 4) // Skip first line, take next 3
    .map(line => {
      // Extract function name from stack line
      // Format usually: "    at functionName (file:line:col)"
      const match = line.match(/at\s+([^\s(]+)/);
      return match ? match[1] : '';
    })
    .filter(Boolean)
    .join('|');

  return lines;
}

/**
 * Create a fingerprint for a log entry
 * Used to detect duplicate logs within a time window
 *
 * Fingerprint is based on:
 * - Message content
 * - Area/module
 * - Stack trace (if error)
 *
 * This ensures that the same error from the same place is recognized as a duplicate
 *
 * @param options - Fingerprint options
 * @returns Fingerprint string (40 chars, hex format)
 */
export interface FingerprintOptions {
  message: string;
  area: string;
  error?: Error;
  context?: string; // Additional context for uniqueness
}

export function createFingerprint(options: FingerprintOptions): string {
  const {
    message,
    area,
    error,
    context = '',
  } = options;

  // Build fingerprint string from key components
  const stackSummary = getStackSummary(error);
  const fingerprintStr = `${message}|${area}|${stackSummary}|${context}`;

  // Create a deterministic hash
  const hash = simpleHash(fingerprintStr);

  // Also include first 10 chars of message for readability
  const messagePrefix = message.substring(0, 10).replace(/[^a-z0-9]/gi, '').toLowerCase();

  // Return combined fingerprint: readable prefix + hash
  return `${messagePrefix}_${hash}`.substring(0, 40);
}

/**
 * Extract a stack trace summary from error at any depth
 * Useful for fingerprinting errors that come from try-catch
 *
 * @param errorOrMessage - Error object or message string
 * @returns Stack summary
 */
export function extractStackSummary(errorOrMessage: Error | string): string {
  if (typeof errorOrMessage === 'string') {
    return '';
  }

  return getStackSummary(errorOrMessage);
}

/**
 * Create a fingerprint from an error
 * Convenience function for error logging
 *
 * @param error - Error object
 * @param area - Area/module where error occurred
 * @returns Fingerprint string
 */
export function createErrorFingerprint(error: Error, area: string): string {
  return createFingerprint({
    message: error.message,
    area,
    error,
  });
}

/**
 * Compare two fingerprints for similarity
 * Useful for finding related errors
 *
 * @param fp1 - First fingerprint
 * @param fp2 - Second fingerprint
 * @returns Similarity score (0-1, where 1 is identical)
 */
export function compareFingertprints(fp1: string, fp2: string): number {
  if (fp1 === fp2) return 1;

  // Extract message prefix (first part before underscore)
  const prefix1 = fp1.split('_')[0];
  const prefix2 = fp2.split('_')[0];

  // If message prefixes match, consider them related (0.8)
  if (prefix1 === prefix2 && prefix1.length > 0) {
    return 0.8;
  }

  return 0;
}

/**
 * Generate a fingerprint for deduplication over a time window
 * Includes timestamp-based bucketing (1-minute buckets) to allow
 * the same error to be logged once per minute
 *
 * @param baseFingerprint - Base fingerprint from createFingerprint
 * @param timestamp - Timestamp (in seconds)
 * @returns Time-bucketed fingerprint
 */
export function createTimeBucketedFingerprint(
  baseFingerprint: string,
  timestamp: number = Date.now()
): string {
  // Create 30-second buckets
  const bucket = Math.floor(timestamp / 30000);
  return `${baseFingerprint}:${bucket}`;
}
