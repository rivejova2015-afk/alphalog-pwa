// Per-operation step-up (audit 2026-06, Área 13 — backlog).
//
// Sensitive operations (financial writes, data exports) require a *recent*
// second-factor verification, not just an AAL2 session that may be hours old.
// Freshness is read from the Supabase access-token `amr` claim (the JWT is
// signed by Supabase, so the timestamps are unforgeable). To refresh it, the
// user re-verifies MFA via /auth/stepup?reauth=1, which mints a new token.

import type { SupabaseClient } from "@supabase/supabase-js";

export const STEPUP_MAX_AGE_SEC = 15 * 60; // 15 minutes

export type StepUpResult =
  | { ok: true }
  | { ok: false; status: number; reason: "no_session" | "mfa_required" | "step_up_required" | "step_up_stale" };

type AmrEntry = { method?: string; timestamp?: number };
type AccessTokenClaims = { aal?: string; amr?: AmrEntry[] };

/** Decode a JWT payload WITHOUT verifying — callers must already have validated
 *  the session (getUser). We only read the `aal` / `amr` claims. */
export function decodeJwtClaims(token: string | null | undefined): AccessTokenClaims | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** Pure evaluation of step-up freshness from decoded token claims. */
export function evaluateStepUp(
  claims: AccessTokenClaims | null,
  nowSec: number,
  maxAgeSec: number = STEPUP_MAX_AGE_SEC,
): StepUpResult {
  if (!claims) return { ok: false, status: 401, reason: "no_session" };
  if (claims.aal !== "aal2") return { ok: false, status: 403, reason: "mfa_required" };

  const mfaTimestamps = (claims.amr ?? [])
    .filter((m) => m.method && m.method !== "password" && typeof m.timestamp === "number")
    .map((m) => m.timestamp as number);

  if (mfaTimestamps.length === 0) return { ok: false, status: 403, reason: "step_up_required" };
  if (nowSec - Math.max(...mfaTimestamps) > maxAgeSec) {
    return { ok: false, status: 403, reason: "step_up_stale" };
  }
  return { ok: true };
}

/** Cookie-session routes: read the current access token from the session. */
export async function requireFreshStepUp(
  supabase: SupabaseClient,
  maxAgeSec: number = STEPUP_MAX_AGE_SEC,
): Promise<StepUpResult> {
  const { data: { session } } = await supabase.auth.getSession();
  return evaluateStepUp(decodeJwtClaims(session?.access_token), Math.floor(Date.now() / 1000), maxAgeSec);
}

/** Bearer-token routes: evaluate the supplied access token directly. */
export function requireFreshStepUpFromToken(
  token: string | null | undefined,
  maxAgeSec: number = STEPUP_MAX_AGE_SEC,
): StepUpResult {
  return evaluateStepUp(decodeJwtClaims(token), Math.floor(Date.now() / 1000), maxAgeSec);
}
