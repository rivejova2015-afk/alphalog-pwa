/**
 * Coinbase Advanced Trade — spot order placement (REST).
 *
 * Endpoints used:
 *   POST   /api/v3/brokerage/orders
 *   POST   /api/v3/brokerage/orders/batch_cancel
 *   GET    /api/v3/brokerage/orders/historical/{order_id}
 *   GET    /api/v3/brokerage/products/{product_id}
 *
 * Defaults to maker-only (post-only flag) per coinarb-50x design.
 */

import { fetch } from 'undici';
import { randomUUID } from 'node:crypto';
import { buildCdpJwt, type CdpCredentials } from './coinbase-cdp-auth.js';

const HOST = 'api.coinbase.com';
const BASE = `https://${HOST}`;

export type Side = 'BUY' | 'SELL';

export interface LimitOrderRequest {
  productId: string;             // e.g. 'BTC-USD'
  side: Side;
  baseSize: string;              // base currency amount as string (Coinbase requires string)
  limitPrice: string;
  postOnly?: boolean;            // default true
  clientOrderId?: string;        // auto-generated if omitted
}

export interface OrderAck {
  success: boolean;
  orderId?: string;
  clientOrderId: string;
  failureReason?: string;
  raw: unknown;
}

export interface ProductDetails {
  productId: string;
  baseMinSize: number;
  baseIncrement: number;
  quoteIncrement: number;
  priceIncrement: number;
  status: string;
}

export class CoinbaseSpotOrders {
  constructor(private readonly creds: CdpCredentials) {}

  async placeLimit(req: LimitOrderRequest): Promise<OrderAck> {
    const clientOrderId = req.clientOrderId ?? randomUUID();
    const body = {
      client_order_id: clientOrderId,
      product_id: req.productId,
      side: req.side,
      order_configuration: {
        limit_limit_gtc: {
          base_size: req.baseSize,
          limit_price: req.limitPrice,
          post_only: req.postOnly ?? true,
        },
      },
    };

    const path = '/api/v3/brokerage/orders';
    const raw = await this.signedRequest('POST', path, body);
    const parsed = raw as { success?: boolean; order_id?: string; failure_reason?: string };
    return {
      success: Boolean(parsed.success),
      orderId: parsed.order_id,
      clientOrderId,
      failureReason: parsed.failure_reason,
      raw,
    };
  }

  async cancel(orderIds: string[]): Promise<unknown> {
    return this.signedRequest('POST', '/api/v3/brokerage/orders/batch_cancel', {
      order_ids: orderIds,
    });
  }

  async getOrder(orderId: string): Promise<unknown> {
    return this.signedRequest('GET', `/api/v3/brokerage/orders/historical/${orderId}`);
  }

  async getProduct(productId: string): Promise<ProductDetails> {
    const raw = await this.signedRequest('GET', `/api/v3/brokerage/products/${productId}`);
    const r = raw as Record<string, string | undefined>;
    return {
      productId,
      baseMinSize: Number(r.base_min_size ?? r.min_market_funds ?? '0'),
      baseIncrement: Number(r.base_increment ?? '0'),
      quoteIncrement: Number(r.quote_increment ?? '0'),
      priceIncrement: Number(r.price_increment ?? r.quote_increment ?? '0'),
      status: String(r.status ?? 'unknown'),
    };
  }

  async getAccounts(): Promise<unknown> {
    return this.signedRequest('GET', '/api/v3/brokerage/accounts');
  }

  private async signedRequest(method: string, path: string, body?: unknown): Promise<unknown> {
    const jwt = await buildCdpJwt(this.creds, method, HOST, path);
    const init: Parameters<typeof fetch>[1] = {
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    const resp = await fetch(`${BASE}${path}`, init);
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Coinbase ${method} ${path} → ${resp.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : {};
  }
}
