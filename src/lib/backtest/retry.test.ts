import { describe, it, expect, vi } from "vitest";
import { withRetry, isRetryableError, computeBackoff } from "./retry";

describe("isRetryableError — retryable", () => {
  it("rate limit 429", () => {
    expect(isRetryableError(new Error("Polygon rate limit exceeded (free tier: 5 req/min)"))).toBe(true);
    expect(isRetryableError(new Error("HTTP 429"))).toBe(true);
  });

  it("5xx server errors", () => {
    expect(isRetryableError(new Error("HTTP 500"))).toBe(true);
    expect(isRetryableError(new Error("HTTP 503 Service Unavailable"))).toBe(true);
    expect(isRetryableError(new Error("HTTP 504 Gateway Timeout"))).toBe(true);
  });

  it("network errors", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("ENOTFOUND api.polygon.io"))).toBe(true);
    expect(isRetryableError(new Error("socket hang up"))).toBe(true);
  });

  it("AbortError from timeout", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    expect(isRetryableError(err)).toBe(true);
    expect(isRetryableError(new Error("Polygon Futures fetch timed out after 15s"))).toBe(true);
  });
});

describe("isRetryableError — non-retryable", () => {
  it("missing API keys", () => {
    expect(isRetryableError(new Error("POLYGON_API_KEY not set"))).toBe(false);
    expect(isRetryableError(new Error("OANDA token not set"))).toBe(false);
  });

  it("invalid mapping / unsupported symbol", () => {
    expect(isRetryableError(new Error("No Polygon mapping for symbol FOOBAR"))).toBe(false);
    expect(isRetryableError(new Error("Unsupported timeframe for Polygon Futures: MN1"))).toBe(false);
  });

  it("auth errors", () => {
    expect(isRetryableError(new Error("Polygon Futures: invalid API key"))).toBe(false);
    expect(isRetryableError(new Error("Polygon Futures: subscription does not include futures data"))).toBe(false);
    expect(isRetryableError(new Error("OANDA: plan does not include forex"))).toBe(false);
  });

  it("non-Error values", () => {
    expect(isRetryableError("just a string")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError({ code: 429 })).toBe(false);
  });
});

describe("computeBackoff", () => {
  it("attempt 1 with no jitter returns base delay", () => {
    expect(computeBackoff(1, 500, 2, 0)).toBe(500);
  });

  it("exponential growth with factor=2", () => {
    expect(computeBackoff(1, 500, 2, 0)).toBe(500);
    expect(computeBackoff(2, 500, 2, 0)).toBe(1000);
    expect(computeBackoff(3, 500, 2, 0)).toBe(2000);
  });

  it("jitter stays within ±fraction bounds", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const delay = computeBackoff(1, 1000, 2, 0.2);
      seen.add(delay);
      // 1000 ± 20% = [800, 1200]
      expect(delay).toBeGreaterThanOrEqual(800);
      expect(delay).toBeLessThanOrEqual(1200);
    }
    // With 200 samples we should see variability (not all the same value).
    expect(seen.size).toBeGreaterThan(10);
  });

  it("never returns negative", () => {
    for (let i = 0; i < 50; i++) {
      expect(computeBackoff(1, 100, 1, 0.99)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("withRetry", () => {
  it("returns value when fn succeeds first try", async () => {
    const fn = vi.fn().mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("Polygon rate limit exceeded"))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries up to maxRetries times then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("HTTP 503"));
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow("HTTP 503");
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does NOT retry on non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("POLYGON_API_KEY not set"));
    await expect(withRetry(fn, { maxRetries: 5, baseDelayMs: 1 })).rejects.toThrow(/not set/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on 401/403", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Polygon Futures: invalid API key"));
    await expect(withRetry(fn, { maxRetries: 5, baseDelayMs: 1 })).rejects.toThrow(/invalid API key/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects custom isRetryable predicate", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("custom non-standard error"));
    const isRetryable = vi.fn().mockReturnValue(true);
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1, isRetryable })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
    expect(isRetryable).toHaveBeenCalledTimes(2);
  });

  it("invokes onRetry callback with attempt number and error", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockRejectedValueOnce(new Error("HTTP 429"))
      .mockResolvedValueOnce("ok");
    const result = await withRetry(fn, { baseDelayMs: 1, onRetry });
    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), expect.any(Number));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), expect.any(Number));
  });

  it("waits between retries (smoke test with fake timers)", async () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("HTTP 500"))
        .mockResolvedValueOnce("ok");
      const promise = withRetry(fn, { baseDelayMs: 100, jitter: 0 });
      await vi.advanceTimersByTimeAsync(150);
      const result = await promise;
      expect(result.value).toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });
});
