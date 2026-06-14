// Unit tests for src/lib/security/timing.ts.
//
// Foundational helper consumed por crons (bot-slo-monitor, polyarb-heartbeat,
// recurring-costs, etc) y endpoints internos. Constant-time comparison evita
// timing attacks en secret check; los tests cubren los edge cases que el
// resto de los handlers asumen.

import { describe, it, expect } from "vitest";
import { safeCompareTokens, validateBearerToken } from "../timing";

describe("safeCompareTokens", () => {
  it("returns true para candidate === expected", () => {
    expect(safeCompareTokens("abc123", "abc123")).toBe(true);
  });

  it("returns false para mismatch del mismo length", () => {
    expect(safeCompareTokens("abc123", "abc124")).toBe(false);
  });

  it("returns false cuando los lengths difieren (early exit)", () => {
    expect(safeCompareTokens("short", "much-longer-secret")).toBe(false);
  });

  it("returns false cuando candidate es null", () => {
    expect(safeCompareTokens(null, "secret")).toBe(false);
  });

  it("returns false cuando candidate es undefined", () => {
    expect(safeCompareTokens(undefined, "secret")).toBe(false);
  });

  it("returns false cuando expected es null/undefined", () => {
    expect(safeCompareTokens("candidate", null)).toBe(false);
    expect(safeCompareTokens("candidate", undefined)).toBe(false);
  });

  it("returns false cuando ambos son empty strings (defensive)", () => {
    // Empty string es falsy → early return false.
    expect(safeCompareTokens("", "")).toBe(false);
  });

  it("returns true para tokens con UTF-8 multi-byte chars del mismo length", () => {
    expect(safeCompareTokens("café-ñ", "café-ñ")).toBe(true);
  });

  it("returns false para mismatch UTF-8 del mismo byte-length", () => {
    expect(safeCompareTokens("café-ñ", "café-ç")).toBe(false);
  });

  it("returns true para tokens muy largos (256 bytes)", () => {
    const long = "x".repeat(256);
    expect(safeCompareTokens(long, long)).toBe(true);
  });
});

describe("validateBearerToken", () => {
  it("returns 500 cuando expected (env var) no está configurado", () => {
    const r = validateBearerToken("Bearer abc", undefined, "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 500, error: "CRON_SECRET not configured" });
  });

  it("returns 500 cuando expected es empty string", () => {
    const r = validateBearerToken("Bearer abc", "", "MY_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 500, error: "MY_SECRET not configured" });
  });

  it("returns 401 cuando authHeader es null", () => {
    const r = validateBearerToken(null, "secret", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401, error: "Unauthorized" });
  });

  it("returns 401 cuando authHeader no tiene prefix 'Bearer '", () => {
    const r = validateBearerToken("Token abc", "secret", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401, error: "Unauthorized" });
  });

  it("returns 401 cuando authHeader='Bearer ' sin token", () => {
    const r = validateBearerToken("Bearer ", "secret", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401, error: "Unauthorized" });
  });

  it("returns 401 cuando el token != expected", () => {
    const r = validateBearerToken("Bearer wrong-token", "right-token", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401, error: "Unauthorized" });
  });

  it("returns {ok:true} cuando el token === expected", () => {
    const r = validateBearerToken("Bearer my-secret-token", "my-secret-token", "CRON_SECRET");
    expect(r.ok).toBe(true);
  });

  it("es case-sensitive en el prefix 'Bearer ' (NO 'bearer ')", () => {
    const r = validateBearerToken("bearer my-token", "my-token", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401 });
  });

  it("returns 401 cuando authHeader es solo whitespace", () => {
    const r = validateBearerToken("   ", "secret", "CRON_SECRET");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ status: 401 });
  });

  it("envName aparece en el error message del 500 para debugging", () => {
    const r = validateBearerToken("Bearer x", null, "OPS_CRON_SECRET");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("OPS_CRON_SECRET not configured");
    }
  });
});
