/**
 * Coinbase International Exchange — perpetuals order placement (REST).
 *
 * Endpoints used:
 *   POST   /api/v1/orders
 *   DELETE /api/v1/orders                       (batch cancel by ids)
 *   GET    /api/v1/orders/{id}
 *   GET    /api/v1/instruments/{symbol}
 *   GET    /api/v1/portfolios/{portfolio}/positions
 *
 * Defaults to maker-only (TIF=GTC + post_only=true) per coinarb-50x design.
 */

import { fetch } from 'undici';
import { randomUUID } from 'node:crypto';
import { buildIntxHeaders, type IntxCredentials } from './coinbase-intx-auth.js';

const BASE = 'https://api.international.coinbase.com';

export type Side = 'BUY' | 'SELL';

export interface IntxLimitOrderRequest {
  symbol: string;                // e.g. 'BTC-PERP'
  side: Side;
  size: string;                  // contracts (perp), as string
  price: string;
  postOnly?: boolean;            // default true
  clientOrderId?: string;
  /** Override the default portfolio id at call-site (rarely used). */
  portfolio?: string;
}

export interface IntxOrderAck {
  success: boolean;
  orderId?: string;
  clientOrderId: string;
  raw: unknown;
}

export interface IntxInstrument {
  symbol: string;
  baseIncrement: number;
  quoteIncrement: number;
  minOrderSize: number;
  status: string;
}

export class CoinbaseIntxOrders {
  constructor(
    private readonly creds: IntxCredentials,
    private readonly defaultPortfolioId: string,
  ) {}

  async placeLimit(req: IntxLimitOrderRequest): Promise<IntxOrderAck> {
    const clientOrderId = req.clientOrderId ?? randomUUID();
    const portfolio = req.portfolio ?? this.defaultPortfolioId;
    const body = {
      client_order_id: clientOrderId,
      portfolio,
      symbol: req.symbol,
      side: req.side,
      size: req.size,
      price: req.price,
      type: 'LIMIT',
      tif: 'GTC',
      post_only: req.postOnly ?? true,
    };
    const raw = await this.signedRequest('POST', '/api/v1/orders', body);
    const parsed = raw as { id?: string };
    return {
      success: Boolean(parsed.id),
      orderId: parsed.id,
      clientOrderId,
      raw,
    };
  }

  async cancel(orderIds: string[]): Promise<unknown> {
    const path = `/api/v1/orders?order_ids=${orderIds.join(',')}&portfolio=${this.defaultPortfolioId}`;
    return this.signedRequest('DELETE', path);
  }

  async getOrder(orderId: string): Promise<unknown> {
    const path = `/api/v1/orders/${orderId}?portfolio=${this.defaultPortfolioId}`;
    return this.signedRequest('GET', path);
  }

  async getInstrument(symbol: string): Promise<IntxInstrument> {
    const raw = await this.signedRequest('GET', `/api/v1/instruments/${symbol}`);
    const r = raw as Record<string, string | undefined>;
    return {
      symbol,
      baseIncrement: Number(r.base_increment ?? '0'),
      quoteIncrement: Number(r.quote_increment ?? '0'),
      minOrderSize: Number(r.min_order_size ?? r.base_min_size ?? '0'),
      status: String(r.status ?? 'unknown'),
    };
  }

  async getPositions(): Promise<unknown> {
    return this.signedRequest('GET', `/api/v1/portfolios/${this.defaultPortfolioId}/positions`);
  }

  async getPortfolios(): Promise<unknown> {
    return this.signedRequest('GET', '/api/v1/portfolios');
  }

  private async signedRequest(method: string, requestPath: string, body?: unknown): Promise<unknown> {
    const bodyStr = body !== undefined ? JSON.stringify(body) : '';
    const headers = buildIntxHeaders(this.creds, method, requestPath, bodyStr);

    const init: Parameters<typeof fetch>[1] = {
      method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };
    if (bodyStr) init.body = bodyStr;

    const resp = await fetch(`${BASE}${requestPath}`, init);
    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`INTX ${method} ${requestPath} → ${resp.status}: ${text.slice(0, 500)}`);
    }
    return text ? JSON.parse(text) : {};
  }
}
