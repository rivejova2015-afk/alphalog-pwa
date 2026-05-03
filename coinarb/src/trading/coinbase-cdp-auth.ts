/**
 * Coinbase Developer Platform (CDP) JWT auth for the Advanced Trade REST API.
 *
 * Each request signs a short-lived (≤2 min) JWT with ES256 over the route the
 * client is about to call. Coinbase rejects tokens older than 120 s, so the JWT
 * is built fresh on every call.
 *
 * Docs:
 *   https://docs.cdp.coinbase.com/advanced-trade/docs/rest-api-auth
 *   https://docs.cdp.coinbase.com/api-reference/v2/authentication
 */

import { SignJWT, importPKCS8 } from 'jose';
import { randomBytes } from 'node:crypto';

const ALGORITHM = 'ES256';
const TTL_SECONDS = 120;

export interface CdpCredentials {
  /** Full key name, e.g. organizations/{org_id}/apiKeys/{key_id} */
  keyName: string;
  /** EC PRIVATE KEY in PKCS#8 PEM format (literal newlines or "\n" sequences). */
  privateKey: string;
}

/**
 * Build a Coinbase Advanced Trade JWT for the given HTTP request.
 *
 * @param method  HTTP verb (uppercase): "GET" | "POST" | "DELETE"
 * @param host    "api.coinbase.com"
 * @param path    Request path, e.g. "/api/v3/brokerage/orders"
 * @returns       JWT string ready to send as `Authorization: Bearer <jwt>`
 */
export async function buildCdpJwt(
  creds: CdpCredentials,
  method: string,
  host: string,
  path: string,
): Promise<string> {
  const uri = `${method.toUpperCase()} ${host}${path}`;
  const now = Math.floor(Date.now() / 1000);

  const pem = normalizePem(creds.privateKey);
  const key = await importPKCS8(pem, ALGORITHM);

  return await new SignJWT({ uri })
    .setProtectedHeader({
      alg: ALGORITHM,
      kid: creds.keyName,
      nonce: randomBytes(16).toString('hex'),
    })
    .setIssuer('coinbase-cloud')
    .setSubject(creds.keyName)
    .setNotBefore(now)
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(key);
}

function normalizePem(pem: string): string {
  // Env vars are routinely stored with literal "\n" instead of real newlines.
  // jose requires actual newlines for PKCS#8 parsing.
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}
