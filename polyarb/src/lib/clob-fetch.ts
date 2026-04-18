/**
 * CLOB-specific fetch wrapper.
 * Routes requests through a residential proxy if POLYARB_PROXY_URL is set.
 * Only applies to Polymarket CLOB calls — Supabase and Binance are unaffected.
 */

import { ProxyAgent } from 'undici';

let dispatcher: ProxyAgent | undefined;

const proxyUrl = process.env.POLYARB_PROXY_URL;
if (proxyUrl) {
  dispatcher = new ProxyAgent(proxyUrl);
  const masked = proxyUrl.replace(/:([^@:]+)@/, ':***@');
  console.log(`[clob-fetch] Proxy active: ${masked}`);
} else {
  console.log('[clob-fetch] No proxy configured (POLYARB_PROXY_URL not set)');
}

export async function clobFetch(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  if (!dispatcher) {
    return fetch(url, init);
  }
  // undici dispatcher is passed via the non-standard `dispatcher` option
  // which native Node.js fetch (undici-based) accepts
  return fetch(url, { ...init, dispatcher } as RequestInit);
}
