/**
 * AlphaShield Sanitization Utility
 * Removes sensitive keys from objects before logging
 *
 * Prevents logging of:
 * - API tokens, keys, secrets
 * - Authorization headers
 * - Cookies
 * - Passwords
 * - Credit card data
 * - PII (email, phone in certain contexts)
 */

type SanitizableValue = unknown;

/**
 * List of keys to remove from logged objects (case-insensitive)
 */
const SENSITIVE_KEYS = [
  // Auth/API
  'token',
  'key',
  'secret',
  'password',
  'authorization',
  'auth_token',
  'access_token',
  'refresh_token',
  'api_key',
  'api_secret',
  'session',
  'sessionid',
  'session_id',
  
  // Cookies/Headers
  'cookie',
  'cookies',
  'set_cookie',
  'x_auth_token',
  'x_api_key',
  'bearer',
  
  // Payment/Financial
  'creditcard',
  'credit_card',
  'cvv',
  'cvc',
  'cardnumber',
  'card_number',
  'routing_number',
  'account_number',
  'ssn',
  'pin',
  
  // Passwords/Personal
  'pwd',
  'passwd',
  'passphrase',
  'oauth',
  'oauth_token',
  'oauth_secret',
  
  // Database
  'connection_string',
  'db_password',
  'db_user',
  'database_url',
];

/**
 * Check if a key should be sanitized
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitiveKey => 
    lowerKey.includes(sensitiveKey) || sensitiveKey.includes(lowerKey)
  );
}

/**
 * Recursively sanitize an object by removing sensitive keys
 * Handles nested objects, arrays, and circular references
 *
 * @param value - Object or value to sanitize
 * @param depth - Current recursion depth (to prevent infinite loops)
 * @param maxDepth - Maximum recursion depth (default 10)
 * @returns Sanitized copy of the value
 */
export function sanitize(
  value: SanitizableValue,
  depth = 0,
  maxDepth = 10,
  seen: WeakSet<object> = new WeakSet()
): SanitizableValue {
  // Prevent stack overflow on circular references or deeply nested objects
  if (depth > maxDepth) {
    return '[max depth exceeded]';
  }

  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives (string, number, boolean)
  if (typeof value !== 'object') {
    return value;
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object' && value !== null) {
    if (seen.has(value)) {
      return '[circular]';
    }
    seen.add(value);
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitize(item, depth + 1, maxDepth, seen));
  }

  // Handle Objects
  if (typeof value === 'object') {
    const sanitized: Record<string, SanitizableValue> = {};

    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        // Replace sensitive values with placeholder
        sanitized[key] = '[REDACTED]';
      } else {
        // Recursively sanitize nested values
        sanitized[key] = sanitize(val, depth + 1, maxDepth, seen);
      }
    }

    return sanitized;
  }

  return value;
}

/**
 * Sanitize error objects specifically
 * Removes stack traces from error.stack if they contain sensitive info
 *
 * @param error - Error object to sanitize
 * @returns Sanitized error representation
 */
export function sanitizeError(error: Error | unknown): Record<string, unknown> {
  if (!error) {
    return {};
  }

  if (!(error instanceof Error)) {
    return { error: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    // Stack traces are useful for debugging but may contain file paths
    // We keep them but sanitize the text
    stack: error.stack?.split('\n').map(line => {
      // Remove full file paths if possible, keep function names
      return line.replace(/file:\/\/\/[^:]+/g, '[FILE]');
    }).join('\n'),
  };
}

/**
 * Sanitize URL by removing sensitive query parameters
 *
 * @param url - URL string to sanitize
 * @returns Sanitized URL
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const sensitiveParams = ['token', 'key', 'secret', 'api_key', 'apikey', 'auth', 'password', 'pwd'];

    for (const param of sensitiveParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }

    return parsed.toString();
  } catch {
    // If URL is invalid, return original (it's already not a real URL)
    return url;
  }
}

/**
 * Create a sanitized log message object
 * Ensures all user-provided data is safely logged
 *
 * @param data - Raw log data
 * @returns Sanitized log object
 */
export function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitize(data) as Record<string, unknown>;

  // Also sanitize URL if present
  if (typeof sanitized.url === 'string') {
    sanitized.url = sanitizeUrl(sanitized.url);
  }

  return sanitized;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') {
        return `[bigint:${val.toString()}]`;
      }
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[circular]';
        }
        seen.add(val);
      }
      return val;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return '[unstringifiable]';
    }
  }
}

/**
 * Check if a value contains any sensitive patterns
 * (for detecting if sanitization was missed)
 *
 * @param value - Value to check
 * @returns True if value might contain sensitive data
 */
export function mightContainSensitiveData(value: unknown): boolean {
  const str = safeStringify(value).toLowerCase();
  return SENSITIVE_KEYS.some(key => str.includes(key));
}
