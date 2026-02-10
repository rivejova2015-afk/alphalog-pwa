// src/lib/security/retry.ts

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  jitter?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const computeDelay = (
  attempt: number,
  minDelayMs: number,
  maxDelayMs: number,
  factor: number,
  jitter: number
) => {
  const base = minDelayMs * Math.pow(factor, attempt - 1);
  const jitterOffset = base * jitter * (Math.random() - 0.5) * 2;
  return clamp(Math.round(base + jitterOffset), minDelayMs, maxDelayMs);
};

export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    minDelayMs = 300,
    maxDelayMs = 3000,
    factor = 2,
    jitter = 0.2,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let attempt = 0;
  // attempts = retries + 1
  while (attempt <= retries) {
    attempt += 1;
    try {
      return await fn();
    } catch (error) {
      const retry = attempt <= retries && shouldRetry(error, attempt);
      if (!retry) {
        throw error;
      }
      const delayMs = computeDelay(attempt, minDelayMs, maxDelayMs, factor, jitter);
      if (onRetry) {
        onRetry(error, attempt, delayMs);
      }
      await sleep(delayMs);
    }
  }

  // Should never reach here
  throw new Error("Retry attempts exhausted");
}

export const isRetryableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; status?: number; name?: string };
  const retryableCodes = ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND"];

  if (err.code && retryableCodes.includes(err.code)) {
    return true;
  }

  if (typeof err.status === "number" && err.status >= 500) {
    return true;
  }

  if (err.name === "FetchError") {
    return true;
  }

  return false;
};
