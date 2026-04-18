/**
 * Timing-safe token verification utilities.
 *
 * Uses Node.js `timingSafeEqual` to prevent timing attacks on secret comparison.
 * All shared token checks (cron, ops, internal API) should go through here.
 */

import { timingSafeEqual } from "crypto";

/**
 * Compare a candidate token to the expected secret using constant-time comparison.
 * Returns false if either value is missing or lengths differ.
 */
export function safeCompareTokens(candidate: string | null | undefined, expected: string | null | undefined): boolean {
  if (!candidate || !expected) return false;
  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Extract Bearer token from Authorization header and compare to expected secret.
 */
export function validateBearerToken(
  authHeader: string | null | undefined,
  expected: string | null | undefined,
  envName: string,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!expected) {
    return { ok: false, status: 500, error: `${envName} not configured` };
  }
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!safeCompareTokens(token, expected)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
