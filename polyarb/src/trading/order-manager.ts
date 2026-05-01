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
import { ClobSigner, ClobProxySigner, Side, type SignedOrder } from './clob-signer.js';
import { buildL2AuthHeaders } from './clob-auth.js';
import { clobFetch } from '../lib/clob-fetch.js';

export interface OrderParams {
  conditionId: string;
  yesTokenId: string;    // ERC1155 token ID for the YES outcome
  noTokenId: string;     // ERC1155 token ID for the NO outcome (from gamma API, NOT yesToken XOR 1)
  marketSlug: string;
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  price: number;          // Limit price (0–1)
  sizeUsd: number;        // Size in USD
  feeRateBps?: number;    // Maker fee rate required by this market (default 1000 for btc-updown-5m)
  negRisk?: boolean;      // True for NEG_RISK markets (btc-updown-5m) — different EIP-712 contract
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
const USDC_NATIVE  = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC on Polygon (2024+)
const USDC_E       = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e bridged (legacy)
const PUSD         = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB'; // Polymarket USD (newest)
const POLYGON_RPC  = process.env.POLYGON_RPC_URL ?? 'https://polygon.api.onfinality.io/public';
const USDC_ABI = ['function balanceOf(address account) view returns (uint256)'];

export class OrderManager {
  private signer:        ClobSigner | ClobProxySigner | null;
  private apiKey:        string;
  private apiSecret:     string;
  private apiPassphrase: string;
  private walletAddress = '';  // POLY_ADDRESS used in HMAC auth headers
  private signerAddress: string;  // address that signs EIP-712 orders (= API key owner)
  private dryRun:        boolean;

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
    this.dryRun        = dryRun;

    if (dryRun) {
      this.signer        = null;
      this.signerAddress = '';
      this.walletAddress = walletAddress ?? '';
      console.log('[order-manager] DRY_RUN mode — orders will be simulated');
      return;
    }

    // POLY_ADDRESS = L1 wallet address (api_key owner) — used in HMAC auth headers.
    // api_secret is ONLY for HMAC; EIP-712 orders are signed with the L1 private key.
    const l1PK      = privateKey ? (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) : null;
    const l1Address = l1PK ? new ethers.Wallet(l1PK).address : (walletAddress ?? '');
    this.walletAddress = l1Address;  // POLY_ADDRESS for HMAC

    if (l1PK) {
      const makerAddress = walletAddress ?? l1Address;
      if (walletAddress && walletAddress.toLowerCase() !== l1Address.toLowerCase()) {
        this.signer        = new ClobProxySigner(l1PK, makerAddress);
        this.signerAddress = l1Address;
        this.walletAddress = makerAddress;  // POLY_ADDRESS = proxy (API key owner), not signer
        console.log(`[order-manager] POLY_PROXY signer — maker: ${makerAddress} signer: ${l1Address} POLY_ADDRESS: ${makerAddress}`);
      } else {
        this.signer        = new ClobSigner(l1PK);
        this.signerAddress = l1Address;
        console.log(`[order-manager] EOA signer (L1): ${l1Address}`);
      }
      return;
    }

    this.signer        = null;
    this.signerAddress = '';
    console.warn('[order-manager] No signer — set POLYARB_WALLET_PRIVATE_KEY');
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
      trade_type:            'SIMULATED',
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
      // Select the correct token ID: YES or NO (both come directly from gamma API)
      const tokenId = params.outcome === 'YES' ? params.yesTokenId : params.noTokenId;

      // Round price to 2 decimal places — Polymarket requires cent-level precision
      const price = Math.round(params.price * 100) / 100;

      // btc-updown-5m markets require feeRateBps=1000 in the EIP-712 struct.
      const signed: SignedOrder = await this.signer!.signOrder({
        tokenId,
        side:       params.side === 'BUY' ? Side.BUY : Side.SELL,
        price,
        sizeUsd:    params.sizeUsd,
        feeRateBps: params.feeRateBps ?? 1000,
        negRisk:    params.negRisk ?? false,
      });

      // Submit to CLOB — official @polymarket/clob-client format:
      // { deferExec, order: { salt: INT, side: "BUY"|"SELL", ... }, owner, orderType }
      const body = JSON.stringify({
        deferExec: false,
        order: {
          ...signed,
          salt: Number.parseInt(signed.salt, 10),   // must be integer in JSON
          side: params.side === 'BUY' ? 'BUY' : 'SELL',  // must be string in JSON
        },
        owner:     this.apiKey,  // must equal creds.key (the api_key, not a wallet address)
        orderType: 'GTC',
      });
      const authHeaders = buildL2AuthHeaders(
        this.apiKey,
        this.apiSecret,
        this.apiPassphrase,
        this.walletAddress,  // POLY_ADDRESS = L1 signer wallet
        'POST',
        '/order',
        body,
      );
      const res = await clobFetch(`${CLOB_BASE}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body,
        signal: AbortSignal.timeout(12_000),
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
        trade_type:            'ENTRY',
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
      const res = await clobFetch(`${CLOB_BASE}${path}`, {
        method: 'DELETE',
        headers: authHeaders,
        signal: AbortSignal.timeout(12_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Ask the Polymarket CLOB to re-read on-chain allowances/balance for this
   * wallet. Useful at boot or after a deposit so the cached `balance` reported
   * by `/balance-allowance` reflects current on-chain state. No tx signing.
   */
  async updateBalanceAllowance(): Promise<boolean> {
    if (this.dryRun || !this.apiKey || !this.walletAddress) return false;
    try {
      const path = '/balance-allowance/update';
      const qs   = '?asset_type=COLLATERAL&signature_type=0';
      const headers = buildL2AuthHeaders(
        this.apiKey, this.apiSecret, this.apiPassphrase,
        this.walletAddress, 'GET', path,
      );
      const res = await clobFetch(`${CLOB_BASE}${path}${qs}`, { headers: headers as Record<string, string> });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[order-manager] balance-allowance/update HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return false;
      }
      console.log('[order-manager] CLOB balance-allowance refresh OK');
      return true;
    } catch (err) {
      console.warn(`[order-manager] balance-allowance/update threw: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Fetch real USDC balance from the Polymarket CLOB.
   * Returns null if unavailable (dry run, no auth, or network error).
   */
  async fetchBalance(): Promise<number | null> {
    if (this.dryRun || !this.apiKey || !this.walletAddress) return null;
    try {
      const path = '/balance-allowance';
      const qs   = '?asset_type=COLLATERAL&signature_type=0';
      const headers = buildL2AuthHeaders(
        this.apiKey, this.apiSecret, this.apiPassphrase,
        this.walletAddress, 'GET', path,
      );
      const res = await clobFetch(`${CLOB_BASE}${path}${qs}`, { headers: headers as Record<string, string> });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[order-manager] balance HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }
      const json = await res.json() as { balance?: string; allowance?: string };
      console.log(`[order-manager] balance raw: ${JSON.stringify(json)}`);
      const raw = json.balance;
      return raw ? parseFloat(raw) / 1e6 : null;  // CLOB balance is in micro-USDC (1e6)
    } catch {
      return null;
    }
  }

  /**
   * Fetch combined balance: CLOB-approved USDC + on-chain wallet USDC (all variants).
   * Polymarket has used 3 collateral tokens on Polygon: pUSD, native USDC, USDC.e.
   * On-chain wallet check ensures redeemed tokens are visible even before CLOB deposit.
   */
  async fetchOnChainBalance(): Promise<{ clob: number | null; wallet: number | null; total: number | null }> {
    const clob = await this.fetchBalance();

    // Check on-chain wallet balance if we have an address
    let wallet: number | null = null;
    if (this.walletAddress) {
      try {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137, { staticNetwork: ethers.Network.from(137) });
        const [bPusd, bUsdc, bUsdce]: [bigint, bigint, bigint] = await Promise.all([
          (new ethers.Contract(PUSD,       USDC_ABI, provider).balanceOf(this.walletAddress) as Promise<bigint>),
          (new ethers.Contract(USDC_NATIVE, USDC_ABI, provider).balanceOf(this.walletAddress) as Promise<bigint>),
          (new ethers.Contract(USDC_E,     USDC_ABI, provider).balanceOf(this.walletAddress) as Promise<bigint>),
        ]);
        wallet = Number(bPusd + bUsdc + bUsdce) / 1e6;
        console.log(`[order-manager] Wallet breakdown (${this.walletAddress.slice(0,10)}…) — pUSD: $${(Number(bPusd)/1e6).toFixed(4)} | USDC: $${(Number(bUsdc)/1e6).toFixed(4)} | USDC.e: $${(Number(bUsdce)/1e6).toFixed(4)} | RPC: ${POLYGON_RPC}`);
      } catch (err) {
        wallet = null;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[order-manager] Wallet RPC query failed: ${msg.slice(0, 200)} | RPC: ${POLYGON_RPC}`);
      }
    } else {
      console.warn('[order-manager] No walletAddress configured — cannot read on-chain balance');
    }

    const total = clob !== null && wallet !== null ? clob + wallet
                : clob  !== null ? clob
                : wallet;
    return { clob, wallet, total };
  }
}
