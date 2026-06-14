// Unit tests for src/lib/security/integrity.ts.
//
// HMAC-SHA256 integrity hash + tamper detection con fail-open semantics.
// Validates:
//   - computeIntegrityHash: determinístico, key-order independent (sorted).
//   - verifyIntegrity: same fields → true; tampered → false + alert.
//   - storedHash null/undefined → true (legacy rows skipped).
//   - getSecret falla cuando INTEGRITY_HMAC_SECRET no configurada → catch
//     en verifyIntegrity → fail-open (true).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { triggerAlertMock } = vi.hoisted(() => ({ triggerAlertMock: vi.fn() }));
vi.mock("../securityAlert", () => ({ triggerSecurityAlert: triggerAlertMock }));

let computeIntegrityHash: typeof import("../integrity").computeIntegrityHash;
let verifyIntegrity: typeof import("../integrity").verifyIntegrity;
beforeAll(async () => {
  process.env.INTEGRITY_HMAC_SECRET = "test-hmac-secret-1234567890";
  const mod = await import("../integrity");
  computeIntegrityHash = mod.computeIntegrityHash;
  verifyIntegrity = mod.verifyIntegrity;
});

describe("computeIntegrityHash", () => {
  it("returns SHA-256 hex (64 chars)", () => {
    const h = computeIntegrityHash({ a: 1, b: "x" });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("es determinístico — same input → same hash", () => {
    expect(computeIntegrityHash({ a: 1 })).toBe(computeIntegrityHash({ a: 1 }));
  });

  it("key-order independent (sorted)", () => {
    const h1 = computeIntegrityHash({ a: 1, b: 2, c: 3 });
    const h2 = computeIntegrityHash({ c: 3, a: 1, b: 2 });
    expect(h1).toBe(h2);
  });

  it("inputs distintos producen hashes distintos (entropy)", () => {
    expect(computeIntegrityHash({ a: 1 })).not.toBe(computeIntegrityHash({ a: 2 }));
  });

  it("preserva tipos: 1 vs '1' producen hashes distintos", () => {
    expect(computeIntegrityHash({ a: 1 })).not.toBe(computeIntegrityHash({ a: "1" }));
  });
});

describe("verifyIntegrity", () => {
  beforeEach(() => {
    triggerAlertMock.mockReset();
  });

  it("true cuando storedHash es null (legacy row sin hash → skip)", () => {
    expect(verifyIntegrity({ a: 1 }, null, { table: "trades", id: "t1" })).toBe(true);
    expect(triggerAlertMock).not.toHaveBeenCalled();
  });

  it("true cuando storedHash es undefined", () => {
    expect(verifyIntegrity({ a: 1 }, undefined, { table: "trades", id: "t1" })).toBe(true);
  });

  it("true cuando storedHash matches computed", () => {
    const fields = { user_id: "u1", amount: 100 };
    const hash = computeIntegrityHash(fields);
    expect(verifyIntegrity(fields, hash, { table: "trades", id: "t1" })).toBe(true);
    expect(triggerAlertMock).not.toHaveBeenCalled();
  });

  it("false cuando los fields fueron tampered (hash mismatch)", () => {
    const fields = { user_id: "u1", amount: 100 };
    const hash = computeIntegrityHash(fields);
    const tampered = { ...fields, amount: 999 };  // changed
    expect(verifyIntegrity(tampered, hash, { table: "trades", id: "t1" })).toBe(false);
    expect(triggerAlertMock).toHaveBeenCalledWith("db_tampering_detected", { path: "trades/t1" });
  });

  it("false cuando storedHash tiene length distinto (early exit)", () => {
    const fields = { user_id: "u1", amount: 100 };
    expect(verifyIntegrity(fields, "short-bogus-hash", { table: "x", id: "1" })).toBe(false);
    expect(triggerAlertMock).toHaveBeenCalled();
  });

  it("fail-open cuando getSecret throws (secret unset)", async () => {
    // Drop the secret AND fallback so getSecret() throws inside verifyIntegrity.
    const savedHmac = process.env.INTEGRITY_HMAC_SECRET;
    const savedData = process.env.DATA_ENCRYPTION_KEY;
    delete process.env.INTEGRITY_HMAC_SECRET;
    delete process.env.DATA_ENCRYPTION_KEY;
    const result = verifyIntegrity({ a: 1 }, "any-hash", { table: "x", id: "1" });
    expect(result).toBe(true);  // fail-open
    process.env.INTEGRITY_HMAC_SECRET = savedHmac;
    if (savedData !== undefined) process.env.DATA_ENCRYPTION_KEY = savedData;
  });
});
