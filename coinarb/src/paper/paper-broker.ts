/**
 * Paper-trading broker — simulates fills against the live WS bid/ask.
 *
 * Exposes the SAME async surface as CoinbaseSpotOrders / CoinbaseIntxOrders so
 * the loop can be wired against either real or paper without conditional code:
 *
 *   const spot: SpotBroker = config.paperMode
 *     ? new PaperSpotBroker(coinbaseFeed)
 *     : new CoinbaseSpotOrders(creds);
 *
 *   const perp: PerpBroker = config.paperMode
 *     ? new PaperPerpBroker(intxFeed)
 *     : new CoinbaseIntxOrders(creds, portfolio);
 *
 * Fill model:
 *   - Maker BUY  fills if limit ≥ ask  (would have crossed) AND ≥ bid (would rest)
 *     For coinarb post_only orders we treat any limit ≥ best bid as filled at bid.
 *   - Maker SELL symmetric: limit ≤ ask → fill at ask.
 *   - Otherwise unfilled (returns success:false, simulating a post_only reject).
 *
 * No persistence here — the loop is responsible for writing the synthetic trade
 * to coinarb_trades when it inspects the OrderAck.
 */

import { randomUUID } from 'node:crypto';
import type { CoinbaseFeed } from '../feeds/coinbase-ws.js';
import type { CoinbaseIntxFeed } from '../feeds/coinbase-intx-ws.js';
import type { LimitOrderRequest, OrderAck, ProductDetails, Side } from '../trading/coinbase-spot-orders.js';
import type { IntxLimitOrderRequest, IntxOrderAck, IntxInstrument } from '../trading/coinbase-intx-orders.js';

const SPOT_TO_FEED_SYMBOL: Record<string, 'BTC' | 'ETH' | 'SOL'> = {
  'BTC-USD': 'BTC',
  'ETH-USD': 'ETH',
  'SOL-USD': 'SOL',
};

interface PaperFill {
  filledPrice: number;
  filledAt: number;
}

function simulateFill(
  side: Side,
  limit: number,
  bid: number,
  ask: number,
): PaperFill | null {
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) return null;
  if (side === 'BUY'  && limit >= bid) return { filledPrice: Math.min(limit, ask), filledAt: Date.now() };
  if (side === 'SELL' && limit <= ask) return { filledPrice: Math.max(limit, bid), filledAt: Date.now() };
  return null;
}

export class PaperSpotBroker {
  constructor(private readonly feed: CoinbaseFeed) {}

  async placeLimit(req: LimitOrderRequest): Promise<OrderAck> {
    const clientOrderId = req.clientOrderId ?? randomUUID();
    const symbol = SPOT_TO_FEED_SYMBOL[req.productId];
    const px = symbol ? this.feed.getPrice(symbol) : null;

    if (!px) {
      return {
        success: false,
        clientOrderId,
        failureReason: `paper: no live price for ${req.productId}`,
        raw: { paper: true, reason: 'no_price' },
      };
    }

    const limit = Number(req.limitPrice);
    const fill = simulateFill(req.side, limit, px.bid, px.ask);
    if (!fill) {
      return {
        success: false,
        clientOrderId,
        failureReason: `paper post_only would not rest (side=${req.side} limit=${limit} bid=${px.bid} ask=${px.ask})`,
        raw: { paper: true, reason: 'post_only_reject' },
      };
    }

    const orderId = `paper-spot-${clientOrderId}`;
    return {
      success: true,
      orderId,
      clientOrderId,
      raw: {
        paper: true,
        productId: req.productId,
        side: req.side,
        baseSize: req.baseSize,
        filledPrice: fill.filledPrice,
        filledAt: fill.filledAt,
      },
    };
  }

  async cancel(_orderIds: string[]): Promise<unknown> {
    return { paper: true, cancelled: _orderIds };
  }

  async getOrder(orderId: string): Promise<unknown> {
    return { paper: true, orderId, status: 'FILLED' };
  }

  async getProduct(productId: string): Promise<ProductDetails> {
    // Used by boot-products in PAPER mode to skip the real REST call.
    return {
      productId,
      baseMinSize: 0.0001,
      baseIncrement: 0.00000001,
      quoteIncrement: 0.01,
      priceIncrement: 0.01,
      status: 'paper',
    };
  }

  async getAccounts(): Promise<unknown> {
    return { paper: true, accounts: [] };
  }
}

export class PaperPerpBroker {
  constructor(private readonly feed: CoinbaseIntxFeed) {}

  async placeLimit(req: IntxLimitOrderRequest): Promise<IntxOrderAck> {
    const clientOrderId = req.clientOrderId ?? randomUUID();
    const quote = this.feed.getQuote(req.symbol);

    if (!quote) {
      return {
        success: false,
        clientOrderId,
        raw: { paper: true, reason: 'no_quote' },
      };
    }

    const limit = Number(req.price);
    const fill = simulateFill(req.side, limit, quote.bid, quote.ask);
    if (!fill) {
      return {
        success: false,
        clientOrderId,
        raw: {
          paper: true,
          reason: 'post_only_reject',
          side: req.side,
          limit,
          bid: quote.bid,
          ask: quote.ask,
        },
      };
    }

    const orderId = `paper-perp-${clientOrderId}`;
    return {
      success: true,
      orderId,
      clientOrderId,
      raw: {
        paper: true,
        symbol: req.symbol,
        side: req.side,
        size: req.size,
        filledPrice: fill.filledPrice,
        filledAt: fill.filledAt,
      },
    };
  }

  async cancel(_orderIds: string[]): Promise<unknown> {
    return { paper: true, cancelled: _orderIds };
  }

  async getOrder(orderId: string): Promise<unknown> {
    return { paper: true, orderId, status: 'FILLED' };
  }

  async getInstrument(symbol: string): Promise<IntxInstrument> {
    return {
      symbol,
      baseIncrement: 0.0001,
      quoteIncrement: 0.01,
      minOrderSize: 0.0001,
      status: 'paper',
    };
  }

  async getPositions(): Promise<unknown> {
    return { paper: true, positions: [] };
  }

  async getPortfolios(): Promise<unknown> {
    return { paper: true, portfolios: [] };
  }
}

/** Structural alias the loop uses to swap real vs paper without conditional code. */
export type SpotBroker = Pick<PaperSpotBroker, 'placeLimit' | 'cancel' | 'getOrder' | 'getProduct'>;
export type PerpBroker = Pick<PaperPerpBroker, 'placeLimit' | 'cancel' | 'getOrder' | 'getInstrument'>;
