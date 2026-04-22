/**
 * CLOB fetch utilities.
 *
 * - clobFetch()        → goes through residential proxy (order placement, cancel, balance)
 * - clobFetchDirect()  → direct fetch, no proxy (public orderbook reads — not geoblocked)
 *
 * Proxy bandwidth optimization: orderbooks account for ~99% of CLOB traffic.
 * Routing them directly saves virtually all proxy GB while still unblocking orders.
 *
 * Implementation note: undici ProxyAgent does NOT support HTTPS proxy connections
 * (where the proxy server itself uses TLS). Decodo/Smartproxy uses TLS on port 20000,
 * so we use https-proxy-agent + Node.js https.request and wrap the result in a
 * fetch-compatible Response object.
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import https from 'node:https';
import http from 'node:http';

let proxyAgent: HttpsProxyAgent<string> | undefined;

const proxyUrl = process.env.POLYARB_PROXY_URL;
if (proxyUrl) {
  proxyAgent = new HttpsProxyAgent(proxyUrl);
  const masked = proxyUrl.replace(/:([^@:]+)@/, ':***@');
  console.log(`[clob-fetch] Proxy active: ${masked}`);
} else {
  console.log('[clob-fetch] No proxy configured — orders will fail if geoblocked');
}

/**
 * Wraps Node.js https/http request in a fetch-compatible Response.
 * Used for proxied requests since undici doesn't support HTTPS proxy.
 */
async function nodeRequest(
  url: string,
  init: RequestInit & { signal?: AbortSignal } = {},
  agent?: HttpsProxyAgent<string>,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: (init.method ?? 'GET').toUpperCase(),
      headers: init.headers as Record<string, string> | undefined,
      agent,
    };

    const body = init.body as string | Buffer | undefined;

    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const responseHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v !== undefined) {
            responseHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
          }
        }
        resolve(
          new Response(buffer, {
            status: res.statusCode ?? 200,
            statusText: res.statusMessage ?? '',
            headers: responseHeaders,
          }),
        );
      });
      res.on('error', reject);
    });

    req.on('error', reject);

    if (init.signal) {
      init.signal.addEventListener('abort', () => {
        req.destroy(new Error('Request aborted'));
        reject(new Error('Request aborted'));
      });
    }

    if (body) req.write(body);
    req.end();
  });
}

/** Authenticated CLOB calls: order placement, cancel, balance — go through proxy. */
export async function clobFetch(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  if (!proxyAgent) {
    return fetch(url, init);
  }
  return nodeRequest(url, init, proxyAgent);
}

/** Public CLOB reads: orderbook polling — direct, no proxy bandwidth consumed. */
export async function clobFetchDirect(
  url: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  return fetch(url, init);
}
