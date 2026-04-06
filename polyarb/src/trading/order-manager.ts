/**
 * Polymarket CLOB Order Manager
 *
 * Handles order placement, cancellation, and fill tracking
 * via the Polymarket CLOB REST API.
 *
 * Note: In production, use @polymarket/clob-client for proper
 * EIP-712 order signing. This implementation provides the
 * framework and falls back to REST API calls.
 */

import { getSupabase } from '../supabase.js';

export interface OrderParams {
  conditionId: string;
  marketSlug: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;          // Limit price (0-1)
  sizeUsd: number;        // Size in USD
  agentId: string;
  userId: string;
}

export interface OrderResult {
  success: boolean;
  orderId: string | null;
  filledPrice: number;
  filledSize: number;
  feeUsd: number;
  slippageBps: number;
  executionLatencyMs: number;
  error?: string;
}

const CLOB_BASE = 'https://clob.polymarket.com';
const FEE_RATE_BPS = 156; // Polymarket fee as of Feb 2026

export class OrderManager {
  private apiKey: string;
  private apiSecret: string;
  private apiPassphrase: string;

  constructor(apiKey: string, apiSecret: string, apiPassphrase: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiPassphrase = apiPassphrase;
  }

  /**
   * Place a limit order on Polymarket CLOB.
   */
  async placeOrder(params: OrderParams): Promise<OrderResult> {
    const startMs = Date.now();

    try {
      // Build order payload
      const tokenId = params.conditionId; // YES token
      const orderPayload = {
        tokenID: tokenId,
        price: params.price.toFixed(4),
        size: (params.sizeUsd / params.price).toFixed(4), // shares = USD / price
        side: params.side,
        feeRateBps: FEE_RATE_BPS,
        nonce: Date.now().toString(),
      };

      const res = await fetch(`${CLOB_BASE}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'POLY-API-KEY': this.apiKey,
          'POLY-SECRET': this.apiSecret,
          'POLY-PASSPHRASE': this.apiPassphrase,
        },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(5_000),
      });

      const executionLatencyMs = Date.now() - startMs;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          orderId: null,
          filledPrice: 0,
          filledSize: 0,
          feeUsd: 0,
          slippageBps: 0,
          executionLatencyMs,
          error: `HTTP ${res.status}: ${errText}`,
        };
      }

      const result = await res.json() as {
        orderID?: string;
        status?: string;
        filledPrice?: number;
        filledSize?: number;
      };

      const filledPrice = result.filledPrice ?? params.price;
      const filledSize = result.filledSize ?? parseFloat(orderPayload.size);
      const feeUsd = (filledPrice * filledSize * FEE_RATE_BPS) / 10_000;
      const slippageBps = Math.abs(filledPrice - params.price) / params.price * 10_000;

      // Record trade in Supabase
      const supabase = getSupabase();
      await supabase.from('polyarb_trades').insert({
        user_id: params.userId,
        agent_id: params.agentId,
        order_id: result.orderID ?? null,
        side: params.side,
        price: filledPrice,
        size: filledSize,
        fee_usd: feeUsd,
        fee_rate_bps: FEE_RATE_BPS,
        slippage_bps: slippageBps,
        execution_latency_ms: executionLatencyMs,
        status: 'FILLED',
        raw_response: result,
        executed_at: new Date().toISOString(),
      });

      return {
        success: true,
        orderId: result.orderID ?? null,
        filledPrice,
        filledSize,
        feeUsd,
        slippageBps,
        executionLatencyMs,
      };
    } catch (err) {
      const executionLatencyMs = Date.now() - startMs;
      return {
        success: false,
        orderId: null,
        filledPrice: 0,
        filledSize: 0,
        feeUsd: 0,
        slippageBps: 0,
        executionLatencyMs,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Cancel an open order.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      const res = await fetch(`${CLOB_BASE}/order/${orderId}`, {
        method: 'DELETE',
        headers: {
          'POLY-API-KEY': this.apiKey,
          'POLY-SECRET': this.apiSecret,
          'POLY-PASSPHRASE': this.apiPassphrase,
        },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
