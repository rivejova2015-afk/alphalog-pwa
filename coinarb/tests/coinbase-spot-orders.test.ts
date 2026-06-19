/**
 * Unit tests for the pre-submit min-notional guard added to placeLimit.
 *
 * We avoid hitting the real Coinbase API by subclassing CoinbaseSpotOrders
 * and stubbing the private `signedRequest` indirection through a recorded
 * mock. The class exposes no DI seam, so this is the least invasive way to
 * exercise the public behavior without mocking the network at the undici
 * layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The CDP auth module pulls `jose` which isn't always available in the test
// sandbox (it ships with the Fly build). The pre-submit min-notional logic
// doesn't actually invoke the signer in our subclass — we stub signedRequest
// directly — so we can safely stub the auth module to avoid the transient
// import error.
vi.mock('../src/trading/coinbase-cdp-auth.js', () => ({
  buildCdpJwt: vi.fn(async () => 'fake-jwt'),
}));

import {
  CoinbaseSpotOrders,
  type ProductDetails,
  type PlaceLimitResult,
} from '../src/trading/coinbase-spot-orders.js';
import type { CdpCredentials } from '../src/trading/coinbase-cdp-auth.js';

const FAKE_CREDS: CdpCredentials = {
  keyName: 'organizations/fake/apiKeys/fake',
  privateKey: '-----BEGIN EC PRIVATE KEY-----\nfake\n-----END EC PRIVATE KEY-----',
};

interface RecordedCall {
  method: string;
  path: string;
  body?: unknown;
}

class TestableCoinbaseSpotOrders extends CoinbaseSpotOrders {
  public calls: RecordedCall[] = [];
  public productResponses = new Map<string, ProductDetails>();
  public orderResponse: { success: boolean; order_id?: string; failure_reason?: string } = {
    success: true,
    order_id: 'fake-order-id-123',
  };
  public productFetchError: Error | null = null;

  // Override the GET product call to return canned data without network.
  override async getProduct(productId: string): Promise<ProductDetails> {
    this.calls.push({ method: 'GET', path: `/api/v3/brokerage/products/${productId}` });
    if (this.productFetchError) throw this.productFetchError;
    const p = this.productResponses.get(productId);
    if (!p) throw new Error(`no canned product for ${productId}`);
    return p;
  }

  // Capture the POST order call without sending it.
  protected override async signedRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    this.calls.push({ method, path, body });
    if (path === '/api/v3/brokerage/orders') return this.orderResponse;
    throw new Error(`signedRequest unexpectedly called for ${method} ${path}`);
  }
}

function makeProduct(overrides: Partial<ProductDetails> = {}): ProductDetails {
  return {
    productId: 'BTC-USD',
    baseMinSize: 0.0001,
    baseIncrement: 0.00000001,
    quoteIncrement: 0.01,
    priceIncrement: 0.01,
    status: 'online',
    ...overrides,
  };
}

describe('CoinbaseSpotOrders.placeLimit — min-notional guard', () => {
  let client: TestableCoinbaseSpotOrders;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new TestableCoinbaseSpotOrders(FAKE_CREDS);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('skips the order when computed size < baseMinSize', async () => {
    client.productResponses.set('BTC-USD', makeProduct({ baseMinSize: 0.001 }));

    const result = await client.placeLimit({
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.0001', // 10x below the floor
      limitPrice: '50000',
    });

    expect(result).toEqual({
      skipped: true,
      reason: 'below-min-notional',
      productId: 'BTC-USD',
      computedSize: 0.0001,
      baseMinSize: 0.001,
    });

    const postCalls = client.calls.filter((c) => c.path === '/api/v3/brokerage/orders');
    expect(postCalls).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('BTC-USD computed size 0.0001 < baseMinSize 0.001'),
    );
  });

  it('places the order when computed size >= baseMinSize', async () => {
    client.productResponses.set('BTC-USD', makeProduct({ baseMinSize: 0.0001 }));

    const result = await client.placeLimit({
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.0005',
      limitPrice: '50000',
    });

    expect('skipped' in result).toBe(false);
    const ack = result as Exclude<PlaceLimitResult, { skipped: true }>;
    expect(ack.success).toBe(true);
    expect(ack.orderId).toBe('fake-order-id-123');

    const postCalls = client.calls.filter((c) => c.path === '/api/v3/brokerage/orders');
    expect(postCalls).toHaveLength(1);
  });

  it('places the order when product fetch fails (defer to Coinbase)', async () => {
    client.productFetchError = new Error('product API down');

    const result = await client.placeLimit({
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.0005',
      limitPrice: '50000',
    });

    expect('skipped' in result).toBe(false);
    const postCalls = client.calls.filter((c) => c.path === '/api/v3/brokerage/orders');
    expect(postCalls).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('getProduct(BTC-USD) failed, proceeding to Coinbase'),
      expect.any(Error),
    );
  });

  it('places the order when baseMinSize is 0 (product without floor)', async () => {
    client.productResponses.set('BTC-USD', makeProduct({ baseMinSize: 0 }));

    const result = await client.placeLimit({
      productId: 'BTC-USD',
      side: 'BUY',
      baseSize: '0.000001',
      limitPrice: '50000',
    });

    expect('skipped' in result).toBe(false);
  });

  it('caches getProduct across repeated calls within TTL', async () => {
    client.productResponses.set('BTC-USD', makeProduct({ baseMinSize: 0.0001 }));

    await client.placeLimit({ productId: 'BTC-USD', side: 'BUY', baseSize: '0.0005', limitPrice: '50000' });
    await client.placeLimit({ productId: 'BTC-USD', side: 'BUY', baseSize: '0.0005', limitPrice: '50001' });

    const productCalls = client.calls.filter((c) => c.path === '/api/v3/brokerage/products/BTC-USD');
    expect(productCalls).toHaveLength(1);

    const postCalls = client.calls.filter((c) => c.path === '/api/v3/brokerage/orders');
    expect(postCalls).toHaveLength(2);
  });
});
