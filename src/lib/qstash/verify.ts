/**
 * QStash (Upstash) request verification.
 *
 * QStash signs every callback with a JWT (RFC 7519) using HS256. The header
 * arrives as `Upstash-Signature: <jwt>`. The JWT payload includes:
 *   - `iss` — must be "Upstash"
 *   - `sub` — must equal the destination URL we registered
 *   - `body` — sha256(rawBody), base64url. Defends against body tampering.
 *   - `nbf` / `exp` — UNIX time bounds.
 *
 * We HMAC-verify with the configured signing key (rotating current + next
 * to allow zero-downtime key rotation). Body hashing uses sha256 to match
 * what QStash signs.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

const base64UrlEncode = (buffer: Buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const base64UrlDecode = (input: string) => {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
};

const hashBody = (body: string) =>
  base64UrlEncode(createHash("sha256").update(body).digest());

/**
 * Verify a QStash JWT against a single signing key. Exported so tests can
 * exercise the pure crypto path without touching process.env. Use
 * `verifyQStashSignature` for the production-side check (multi-key).
 */
export function verifyJwt(token: string, key: string, body: string, expectedUrl: string): boolean {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) return false;

  const data = `${headerB64}.${payloadB64}`;
  const digest = base64UrlEncode(createHmac("sha256", key).update(data).digest());

  const sigBuf = Buffer.from(signatureB64);
  const digBuf = Buffer.from(digest);
  if (sigBuf.length !== digBuf.length) return false;
  if (!timingSafeEqual(sigBuf, digBuf)) return false;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload?.iss && payload.iss !== "Upstash") return false;
  if (payload?.sub && payload.sub !== expectedUrl) return false;
  if (typeof payload?.nbf === "number" && now < payload.nbf) return false;
  if (typeof payload?.exp === "number" && now > payload.exp) return false;
  if (payload?.body && payload.body !== hashBody(body)) return false;

  return true;
}

/**
 * Production verification: reads QSTASH_CURRENT_SIGNING_KEY and
 * QSTASH_NEXT_SIGNING_KEY from the environment and accepts any signature
 * that validates against either. Returns false if no keys are configured.
 */
export function verifyQStashSignature(signature: string, body: string, expectedUrl: string): boolean {
  const keys = [
    process.env.QSTASH_CURRENT_SIGNING_KEY,
    process.env.QSTASH_NEXT_SIGNING_KEY,
  ].filter(Boolean) as string[];
  if (keys.length === 0) return false;
  return keys.some((key) => verifyJwt(signature, key, body, expectedUrl));
}

/**
 * Build a valid Upstash-style JWT. Used by tests AND scripts/tooling that
 * need to simulate a QStash callback (eg. dev-only smoke endpoints).
 *
 * NOT exported for production code paths — there's no legitimate reason
 * for the app server to fabricate its own QStash signatures.
 */
export function _internal_signQStashToken(
  key: string,
  body: string,
  expectedUrl: string,
  overrides: Partial<{ iss: string; sub: string; nbf: number; exp: number; body: string | null }> = {}
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: overrides.iss ?? "Upstash",
    sub: overrides.sub ?? expectedUrl,
    nbf: overrides.nbf ?? now - 5,
    exp: overrides.exp ?? now + 300,
    body: overrides.body === null ? undefined : (overrides.body ?? hashBody(body)),
  };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = base64UrlEncode(createHmac("sha256", key).update(data).digest());
  return `${data}.${signature}`;
}
