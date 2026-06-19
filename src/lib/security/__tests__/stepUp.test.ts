// Tests for per-operation step-up freshness (audit 2026-06, Área 13 — backlog).

import { describe, it, expect } from "vitest";
import { evaluateStepUp, decodeJwtClaims, STEPUP_MAX_AGE_SEC } from "../stepUp";

const NOW = 1_000_000; // arbitrary "now" in seconds

describe("evaluateStepUp", () => {
  it("401 no_session when claims are missing", () => {
    expect(evaluateStepUp(null, NOW)).toEqual({ ok: false, status: 401, reason: "no_session" });
  });

  it("403 mfa_required when session is not aal2", () => {
    expect(
      evaluateStepUp({ aal: "aal1", amr: [{ method: "password", timestamp: NOW }] }, NOW),
    ).toMatchObject({ ok: false, status: 403, reason: "mfa_required" });
  });

  it("403 step_up_required when aal2 but no MFA method in amr", () => {
    expect(
      evaluateStepUp({ aal: "aal2", amr: [{ method: "password", timestamp: NOW }] }, NOW),
    ).toMatchObject({ ok: false, reason: "step_up_required" });
  });

  it("ok when aal2 and MFA is recent", () => {
    expect(
      evaluateStepUp({ aal: "aal2", amr: [{ method: "totp", timestamp: NOW - 60 }] }, NOW),
    ).toEqual({ ok: true });
  });

  it("403 step_up_stale when the MFA is older than the window", () => {
    expect(
      evaluateStepUp(
        { aal: "aal2", amr: [{ method: "totp", timestamp: NOW - STEPUP_MAX_AGE_SEC - 1 }] },
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: "step_up_stale" });
  });

  it("uses the MOST RECENT MFA timestamp", () => {
    expect(
      evaluateStepUp(
        {
          aal: "aal2",
          amr: [
            { method: "totp", timestamp: NOW - STEPUP_MAX_AGE_SEC - 100 }, // stale
            { method: "webauthn", timestamp: NOW - 30 }, // fresh
          ],
        },
        NOW,
      ),
    ).toEqual({ ok: true });
  });
});

describe("decodeJwtClaims", () => {
  function makeToken(claims: object): string {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.signature`;
  }

  it("decodes aal/amr from a token payload", () => {
    const token = makeToken({ aal: "aal2", amr: [{ method: "totp", timestamp: 123 }] });
    expect(decodeJwtClaims(token)).toMatchObject({ aal: "aal2" });
  });

  it("returns null on garbage / missing tokens", () => {
    expect(decodeJwtClaims("not-a-jwt")).toBeNull();
    expect(decodeJwtClaims(null)).toBeNull();
    expect(decodeJwtClaims(undefined)).toBeNull();
  });
});
