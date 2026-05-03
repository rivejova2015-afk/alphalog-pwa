/**
 * Coinbase International Exchange (INTX) HMAC-SHA256 auth.
 *
 * Each request signs:  timestamp + method + requestPath + body
 *
 * Headers required by INTX:
 *   CB-ACCESS-KEY        — API key id
 *   CB-ACCESS-SIGN       — base64(HMAC-SHA256(secret, prehash))
 *   CB-ACCESS-TIMESTAMP  — Unix seconds
 *   CB-ACCESS-PASSPHRASE — passphrase set when the key was created
 *
 * Docs: https://docs.cloud.coinbase.com/intx/docs/rest-auth
 */

import { createHmac } from 'node:crypto';

export interface IntxCredentials {
  apiKey: string;
  /** Base64-encoded secret returned at key creation. */
  secret: string;
  passphrase: string;
}

export interface IntxAuthHeaders {
  'CB-ACCESS-KEY': string;
  'CB-ACCESS-SIGN': string;
  'CB-ACCESS-TIMESTAMP': string;
  'CB-ACCESS-PASSPHRASE': string;
}

/**
 * Build the four CB-ACCESS-* headers for a single INTX REST request.
 *
 * @param method       HTTP verb (uppercase)
 * @param requestPath  Path including the query string, e.g. "/api/v1/orders?portfolio=..."
 * @param body         Raw JSON body string ('' for GET/DELETE)
 */
export function buildIntxHeaders(
  creds: IntxCredentials,
  method: string,
  requestPath: string,
  body: string,
): IntxAuthHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const secretBuf = Buffer.from(creds.secret, 'base64');
  const signature = createHmac('sha256', secretBuf).update(prehash).digest('base64');

  return {
    'CB-ACCESS-KEY': creds.apiKey,
    'CB-ACCESS-SIGN': signature,
    'CB-ACCESS-TIMESTAMP': timestamp,
    'CB-ACCESS-PASSPHRASE': creds.passphrase,
  };
}
