/**
 * CLOB fetch utilities.
 *
 * - clobFetch()        → goes through residential proxy (order placement, cancel, balance)
 * - clobFetchDirect()  → direct fetch, no proxy (public orderbook reads — not geoblocked)
 *
 * Proxy bandwidth optimization: orderbooks account for ~99% of CLOB traffic.
 * Routing them directly saves virtually all proxy GB while still unblocking orders.
 */

import { ProxyAgent } from 'undici';

let dispatcher: ProxyAgent | undefined;

const proxyUrl = process.env.POLYARB_PROXY_URL;
if (proxyUrl) {
  dispatcher = new ProxyAgent(proxyUrl);
  const masked = proxyUrl.replace(/:([^@:]+)@/, ':***@');
  console.log(`[clob-fetch] Proxy active: ${masked}`);
} else {
  console.log('[clob-fetch] No proxy configured — orders will fail if geoblocked');
}

/** Authenticated CLOB calls: order placement, cancel, balance — go through proxy. */
export async function clobFetch(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  if (!dispatcher) {
    return fetch(url, init);
  }
  return fetch(url, { ...init, dispatcher } as RequestInit);
}

/** Public CLOB reads: orderbook polling — direct, no proxy bandwidth consumed. */
export async function clobFetchDirect(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  return fetch(url, init);
}
