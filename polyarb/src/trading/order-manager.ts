/**
 * Polymarket CLOB Order Manager
 *
 * Places EIP-712 signed limit orders on the Polymarket CLOB.
 * Supports DRY_RUN mode: all logic runs but no orders are sent.
 *
 * Auth: L2 API key (POLY-API-KEY / POLY-SECRET / POLY-PASSPHRASE)
 * Signing: EIP-712 via ClobSigner (ethers Wallet on Polygon)
 */

import { ethers } from 'ethers';
import { getSupabase } from '../supabase.js';
import { ClobSigner, ClobL2Signer, Side, type SignedOrder } from './clob-signer.js';
import { buildL2AuthHeaders } from './clob-auth.js';

export interface OrderParams {
  conditionId: string;
  yesTokenId: string;    // ERC1155 token ID for the YES outcome
  marketSlug: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;          // Limit price (0–1)
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
  simulated: boolean;
  error?: string;
}

const CLOB_BASE = 'https://clob.polymarket.com';
const FEE_RATE_BPS = 156; // Polymarket standard fee (Feb 2026)

export class OrderManager {
  private signer:   ClobSigner | ClobL2Signer | null;
  private apiKey:       string;
  private apiSecret:    string;
  private apiPassphrase: string;
  private walletAddress: string;
  private dryRun:       boolean;

  constructor(
    apiKey:       string,
    apiSecret:    string,
    apiPassphrase: string,
    privateKey:   string | null,
    dryRun:       boolean,
    walletAddress?: string | null,
  ) {
    this.apiKey        = apiKey;
    this.apiSecret     = apiSecret;
    this.apiPassphrase = apiPassphrase;
    this.walletAddress = walletAddress ?? '';
    this.dryRun        = dryRun;

    if (dryRun) {
      this.signer = null;
      console.log('[order-manager] DRY_RUN mode — orders will be simulated');
    } else if (privateKey) {
      const derivedAddress = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`).address;
      const makerAddress   = walletAddress ?? derivedAddress;

      if (makerAddress.toLowerCase() !== derivedAddress.toLowerCase()) {
        // POLY_PROXY: private key is the MetaMask signer; maker is the Polymarket proxy wallet
        this.signer = new ClobL2Signer(makerAddress, privateKey);
        console.log(`[order-manager] POLY_PROXY signer ready — maker: ${makerAddress} signer: ${derivedAddress}`);
      } else {
        // EOA: private key owns the maker address directly
        this.signer = new ClobSigner(privateKey);
        console.log(`[order-manager] EOA signer ready: ${derivedAddress}`);
      }
    } else {
      this.signer = null;
      console.warn('[order-manager] No signer available — set POLYARB_WALLET_PRIVATE_KEY');
    }
  }

  /**
   * Place a limit order.
   * In DRY_RUN: simulates fill at the requested price, no network call.
   * In LIVE: signs EIP-712, submits to CLOB, records in Supabase.
   */
  async placeOrder(params: OrderParams): Promise<OrderResult> {
    if (this.dryRun) {
      return this.simulateOrder(params);
    }

    if (!this.signer) {
      return {
        success: false,
        orderId: null,
        filledPrice: 0,
        filledSize: 0,
        feeUsd: 0,
        slippageBps: 0,
        executionLatencyMs: 0,
        simulated: false,
        error: 'No signer available — set POLYARB_WALLET_PRIVATE_KEY or verify api_secret is a valid L2 key',
      };
    }

    return this.placeSignedOrder(params);
  }

  // ─── DRY_RUN ─────────────────────────────────────────────────────────────

  private async simulateOrder(params: OrderParams): Promise<OrderResult> {
    const startMs = Date.now();
    const feeUsd = params.sizeUsd * (FEE_RATE_BPS / 10_000);
    const filledSize = params.sizeUsd / params.price;
    const simulatedOrderId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const executionLatencyMs = Date.now() - startMs;

    // Record simulated trade in Supabase for P&L tracking
    const supabase = getSupabase();
    await supabase.from('polyarb_trades').insert({
      user_id:               params.userId,
      agent_id:              params.agentId,
      order_id:              simulatedOrderId,
      condition_id:          params.conditionId,
      market_slug:           params.marketSlug,
      outcome:               params.outcome,
      side:                  params.side,
      price:                 params.price,
      size:                  filledSize,
      size_usd:              params.sizeUsd,
      fee_usd:               feeUsd,
      fee_rate_bps:          FEE_RATE_BPS,
      slippage_bps:          0,
      execution_latency_ms:  executionLatencyMs,
      status:                'SIMULATED',
      raw_response:          { dry_run: true },
      executed_at:           new Date().toISOString(),
    });

    console.log(`[order-manager] [DRY_RUN] ${params.side} ${params.outcome} @ ${params.price} | $${params.sizeUsd.toFixed(2)} | fee $${feeUsd.toFixed(4)}`);

    return {
      success: true,
      orderId: simulatedOrderId,
      filledPrice: params.price,
      filledSize,
      feeUsd,
      slippageBps: 0,
      executionLatencyMs,
      simulated: true,
    };
  }

  // ─── LIVE ─────────────────────────────────────────────────────────────────

  private async placeSignedOrder(params: OrderParams): Promise<OrderResult> {
    const startMs = Date.now();

    try {
      // Select the correct token ID: YES or NO
      const tokenId = params.outcome === 'YES'
        ? params.yesTokenId
        : this.deriveNoTokenId(params.yesTokenId);

      // Sign the order
      const signed: SignedOrder = await this.signer!.signOrder({
        tokenId,
        side:       params.side === 'BUY' ? Side.BUY : Side.SELL,
        price:      params.price,
        sizeUsd:    params.sizeUsd,
        feeRateBps: FEE_RATE_BPS,
      });

      // Submit to CLOB — requires HMAC-signed L2 auth headers
      const body = JSON.stringify(signed);
      const authHeaders = buildL2AuthHeaders(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase,
        this.walletAddress,
        'POST',
        '/order',
        body,
      );
      const res = await fetch(`${CLOB_BASE}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body,
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
          simulated: false,
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
      const filledSize  = result.filledSize  ?? (params.sizeUsd / params.price);
      const feeUsd      = params.sizeUsd * (FEE_RATE_BPS / 10_000);
      const slippageBps = Math.round(Math.abs(filledPrice - params.price) / params.price * 10_000);

      // Record in Supabase
      const supabase = getSupabase();
      await supabase.from('polyarb_trades').insert({
        user_id:               params.userId,
        agent_id:              params.agentId,
        order_id:              result.orderID ?? null,
        condition_id:          params.conditionId,
        market_slug:           params.marketSlug,
        outcome:               params.outcome,
        side:                  params.side,
        price:                 filledPrice,
        size:                  filledSize,
        size_usd:              params.sizeUsd,
        fee_usd:               feeUsd,
        fee_rate_bps:          FEE_RATE_BPS,
        slippage_bps:          slippageBps,
        execution_latency_ms:  executionLatencyMs,
        status:                'FILLED',
        raw_response:          result,
        executed_at:           new Date().toISOString(),
      });

      console.log(`[order-manager] LIVE ${params.side} ${params.outcome} @ ${filledPrice} | $${params.sizeUsd.toFixed(2)} | slippage ${slippageBps}bps`);

      return {
        success: true,
        orderId: result.orderID ?? null,
        filledPrice,
        filledSize,
        feeUsd,
        slippageBps,
        executionLatencyMs,
        simulated: false,
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
        simulated: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Cancel an open order.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    if (this.dryRun) {
      console.log(`[order-manager] [DRY_RUN] Cancel order ${orderId}`);
      return true;
    }
    try {
      const path = `/order/${orderId}`;
      const authHeaders = buildL2AuthHeaders(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase,
        this.walletAddress,
        'DELETE',
        path,
        '',
      );
      const res = await fetch(`${CLOB_BASE}${path}`, {
        method: 'DELETE',
        headers: authHeaders,
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Derive the NO token ID from the YES token ID.
   * On Polymarket binary markets, NO token ID = YES token ID XOR 1
   * (last bit flipped in the ERC1155 token ID space).
   * If this heuristic fails, the order will be rejected by the CLOB.
   */
  private deriveNoTokenId(yesTokenId: string): string {
    try {
      const n = BigInt(yesTokenId);
      return (n ^ 1n).toString();
    } catch {
      return yesTokenId;
    }
  }
}
