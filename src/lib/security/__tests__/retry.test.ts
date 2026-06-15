// Unit tests for src/lib/security/retry.ts.
//
// retryAsync con exponential backoff + jitter + custom shouldRetry. Validates:
//   - Returns el resultado del primer intento exitoso (no retry).
//   - Retries hasta `retries` veces y propaga el último error si todos fallan.
//   - shouldRetry=false → throws inmediato sin más intentos.
//   - onRetry callback se invoca con error + attempt + delayMs.
//   - isRetryableError: ETIMEDOUT/ECONNRESET/EAI_AGAIN/ENOTFOUND + 5xx +
//     FetchError → true; 4xx + ECONNREFUSED no-listed → false.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryAsync, isRetryableError } from "../retry";

describe("retryAsync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns el resultado del primer intento si succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retryAsync(fn, { retries: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries hasta `retries` veces si fn keeps failing, then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("transient"));
    await expect(retryAsync(fn, { retries: 2, minDelayMs: 0, maxDelayMs: 0 }))
      .rejects.toThrow("transient");
    expect(fn).toHaveBeenCalledTimes(3);  // initial + 2 retries
  });

  it("returns success on the 3rd attempt (retries=2)", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValueOnce("recovered");
    const result = await retryAsync(fn, { retries: 2, minDelayMs: 0, maxDelayMs: 0 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("shouldRetry=false on first failure → throws sin retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));
    await expect(retryAsync(fn, { retries: 5, shouldRetry: () => false }))
      .rejects.toThrow("non-retryable");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("shouldRetry recibe (error, attempt) y decide por attempt", async () => {
    const seenAttempts: number[] = [];
    const fn = vi.fn().mockRejectedValue(new Error("err"));
    await expect(retryAsync(fn, {
      retries: 3,
      minDelayMs: 0, maxDelayMs: 0,
      shouldRetry: (_err, attempt) => {
        seenAttempts.push(attempt);
        return attempt < 2;  // only retry once
      },
    })).rejects.toThrow();
    // attempts seen by shouldRetry start at 1, only the first call returns true
    expect(seenAttempts).toEqual([1, 2]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("onRetry callback es invocado con error + attempt + delayMs", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await retryAsync(fn, { retries: 2, minDelayMs: 0, maxDelayMs: 0, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    const [err, attempt, delayMs] = onRetry.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(attempt).toBe(1);
    expect(typeof delayMs).toBe("number");
  });

  it("retries=0 → solo el intento inicial (sin reintentos)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retryAsync(fn, { retries: 0 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("isRetryableError", () => {
  it("ETIMEDOUT, ECONNRESET, EAI_AGAIN, ENOTFOUND → true", () => {
    for (const code of ["ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND"]) {
      expect(isRetryableError({ code })).toBe(true);
    }
  });

  it("status 500 / 502 / 503 → true", () => {
    expect(isRetryableError({ status: 500 })).toBe(true);
    expect(isRetryableError({ status: 502 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it("status 4xx → false (client error, NO retry)", () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError({ status: 404 })).toBe(false);
    expect(isRetryableError({ status: 429 })).toBe(false);
  });

  it("FetchError name → true", () => {
    expect(isRetryableError({ name: "FetchError" })).toBe(true);
  });

  it("error inesperado (ECONNREFUSED no-listed) → false", () => {
    expect(isRetryableError({ code: "ECONNREFUSED" })).toBe(false);
  });

  it("null/undefined/primitives → false (defensive)", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError("error string")).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});
