// Retry helper for transient errors when calling external bar fetchers.
//
// Why retry: a single 429 from Polygon or a 503 from OANDA used to cause the
// chain to drop to the next source (typically Yahoo) and lose data we could
// have gotten with one more attempt. The cost of an extra request when the
// rate-limit window resets in ~1s is far cheaper than backing off to a less-
// preferred source for the whole TF.
//
// Retryable errors:
//   - 429 (rate limit)
//   - 5xx (server errors / outages)
//   - Network: "fetch failed", ECONNRESET, ENOTFOUND, EPIPE
//   - AbortError from our own timeout (retry once at most)
//
// Non-retryable:
//   - 401 (bad API key) — fixing the key requires a deploy, not a retry
//   - 403 (subscription tier) — same
//   - "not set" / "no mapping" — config issue, retry is hopeless
//   - 4xx other than 429 (bad request from us)
//
// Backoff: exponential with ±20% jitter. Base 500ms → 500ms, 1s, 2s. Default
// 2 retries (3 attempts total). At baseline (no retries) costs nothing.

export interface RetryOpts {
  /** Total retries beyond the first attempt. Default 2 → up to 3 attempts. */
  maxRetries?: number;
  /** Base delay between attempts (ms). Default 500. */
  baseDelayMs?: number;
  /** Multiplier applied per retry. Default 2 (exponential). */
  factor?: number;
  /** Jitter applied to each delay as a fraction (0.2 = ±20%). Default 0.2. */
  jitter?: number;
  /**
   * Caller can override classification — useful in tests to force-retry or
   * force-fail a specific error string. By default we use isRetryableError.
   */
  isRetryable?: (err: unknown) => boolean;
  /**
   * Called after each retry attempt with the attempt number (1-indexed) and
   * the error that triggered it. Lets the caller append to its
   * SourceAttempt diagnostics so the UI shows "succeeded after 2 retries".
   */
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

/**
 * Classify whether an error should be retried. Conservative by design: when
 * in doubt, do NOT retry (we'd rather walk to the next source than spin on a
 * misconfigured fetcher).
 */
export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();

  // Non-retryable: configuration problems
  if (msg.includes("not set")) return false;
  if (msg.includes("no mapping") || msg.includes("not supported")) return false;
  if (msg.includes("invalid api key")) return false;
  if (msg.includes("subscription") || msg.includes("plan does not")) return false;
  if (msg.includes("unauthorized") && !msg.includes("rate")) return false;

  // Retryable: transient HTTP failures
  if (msg.includes("rate limit") || msg.includes("429")) return true;
  if (/\bhttp 5\d\d\b/.test(msg)) return true;
  if (msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;

  // Retryable: network/transport
  if (msg.includes("fetch failed")) return true;
  if (msg.includes("econnreset") || msg.includes("etimedout")) return true;
  if (msg.includes("enotfound") || msg.includes("eai_again")) return true;
  if (msg.includes("epipe")) return true;
  if (msg.includes("network") || msg.includes("socket hang up")) return true;

  // Retryable: our own AbortController timeouts. Only retry once via the
  // standard maxRetries budget; the caller's outer timeout limits the
  // worst case.
  if (err.name === "AbortError") return true;
  if (msg.includes("timed out")) return true;

  return false;
}

/**
 * Compute backoff delay with jitter for a given attempt number (1-indexed).
 * Exported for testability.
 */
export function computeBackoff(attempt: number, baseMs: number, factor: number, jitter: number): number {
  const raw = baseMs * Math.pow(factor, attempt - 1);
  const jitterAmount = raw * jitter;
  // [-jitter, +jitter] around the raw delay
  const offset = (Math.random() * 2 - 1) * jitterAmount;
  return Math.max(0, Math.round(raw + offset));
}

/**
 * Wrap an async function with retry-on-transient-error semantics. The
 * function is invoked up to `maxRetries + 1` times. Each retry waits the
 * exponential backoff delay first.
 *
 * If the final attempt fails, the error is re-thrown so the caller can
 * surface it in the SourceAttempt as before.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<{ value: T; attempts: number }> {
  const maxRetries = opts.maxRetries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const factor = opts.factor ?? 2;
  const jitter = opts.jitter ?? 0.2;
  const isRetryable = opts.isRetryable ?? isRetryableError;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const value = await fn();
      return { value, attempts: attempt + 1 };
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !isRetryable(err)) {
        throw err;
      }
      const delay = computeBackoff(attempt + 1, baseDelayMs, factor, jitter);
      if (opts.onRetry) opts.onRetry(attempt + 1, err, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Unreachable — the loop always throws or returns. Satisfies TS.
  throw lastErr;
}
