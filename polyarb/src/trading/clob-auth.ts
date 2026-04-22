/**
 * Polymarket CLOB L2 HMAC authentication headers.
 *
 * Every authenticated request (POST /order, DELETE /order/{id}, GET /balance-allowance, etc.)
 * must include these headers:
 *   POLY_ADDRESS   — wallet address (lowercase)
 *   POLY_SIGNATURE — base64url(HMAC-SHA256(secret, `${timestamp}${method}${path}${body}`))
 *   POLY_TIMESTAMP — unix seconds as string
 *   POLY_API_KEY   — apiKey
 *   POLY_PASSPHRASE — passphrase
 *
 * Notes:
 *   - `secret` must be base64-decoded before HMAC.
 *   - Path MUST be the request pathname (no host, no query string).
 *   - For GET/DELETE, body is empty string.
 */

import crypto from 'node:crypto';

export type L2AuthHeaders = Record<string, string> & {
  POLY_ADDRESS:    string;
  POLY_SIGNATURE:  string;
  POLY_TIMESTAMP:  string;
  POLY_API_KEY:    string;
  POLY_PASSPHRASE: string;
};

export function buildL2AuthHeaders(
  apiKey:        string,
  apiSecret:     string,
  apiPassphrase: string,
  walletAddress: string,
  method:        'GET' | 'POST' | 'DELETE' | 'PUT',
  path:          string,
  body:          string = '',
): L2AuthHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Polymarket HMAC validates against r.URL.Path (no query string), so strip it here.
  const pathOnly  = path.split('?')[0];
  const message   = `${timestamp}${method}${pathOnly}${body}`;

  // Convert base64url → base64 before decode (official clob-client does the same).
  // api_secret may contain '-' and '_' (base64url chars) — normalize to standard base64.
  const secretBase64 = apiSecret.replace(/-/g, '+').replace(/_/g, '/');
  const secretBytes  = Buffer.from(secretBase64, 'base64');
  const hmac         = crypto.createHmac('sha256', secretBytes);
  hmac.update(message);
  const signature   = hmac.digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return {
    POLY_ADDRESS:    walletAddress.toLowerCase(),
    POLY_SIGNATURE:  signature,
    POLY_TIMESTAMP:  timestamp,
    POLY_API_KEY:    apiKey,
    POLY_PASSPHRASE: apiPassphrase,
  };
}
