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

// Polymarket exchange contracts on Polygon mainnet (protocol constants).
// First 3: legacy CTF stack (still active for some markets).
// Last 2: current CLOB-active spenders observed in /balance-allowance responses
// for btc-updown-5m markets — these are the ones the CLOB checks before accepting orders.
// Without ALL 5 approved, /balance-allowance returns 0 even when on-chain USDC.e is positive.
const POLYMARKET_SPENDERS = [
  { name: 'CTFExchange',           address: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E' },
  { name: 'NegRiskAdapter',        address: '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' },
  { name: 'NegRiskExchange',       address: '0xC5d563A36AE78145C45a50134d48A1215220f80a' },
  { name: 'CLOB-CTFExchange-v2',   address: '0xE111180000d2663C0091e4f400237545B87B996B' },
  { name: 'CLOB-NegRiskExchange-v2', address: '0xe2222d279d744050d28e00520010520000310F59' },
] as const;

const ERC20_APPROVE_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export class OrderManager {
  private signer:        ClobSigner | ClobProxySigner | null;
  private apiKey:        string;
  private apiSecret:     string;
  private apiPassphrase: string;
  private walletAddress = '';  // POLY_ADDRESS used in HMAC auth headers
  private signerAddress: string;  // address that signs EIP-712 orders (= API key owner)
  private dryRun:        boolean;
  private l1Wallet:      ethers.Wallet | null = null;  // for on-chain txs (approve, etc.)

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
      this.l1Wallet = new ethers.Wallet(l1PK);
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

      // Submit to CLOB V2 — wire body matches @polymarket/clob-client-v2 orderToJsonV2.
      // Struct (signed): salt, maker, signer, tokenId, makerAmount, takerAmount,
      //                  side(uint8), signatureType, timestamp, metadata(bytes32), builder(bytes32).
      // Wire-only fields (NOT signed): postOnly, expiration; `side` becomes string "BUY"|"SELL".
      const body = JSON.stringify({
        deferExec: false,
        postOnly:  false,
        order: {
          salt:          Number.parseInt(signed.salt, 10),
          maker:         signed.maker,
          signer:        signed.signer,
          tokenId:       signed.tokenId,
          makerAmount:   signed.makerAmount,
          takerAmount:   signed.takerAmount,
          side:          params.side === 'BUY' ? 'BUY' : 'SELL',
          signatureType: signed.signatureType,
          timestamp:     signed.timestamp,
          expiration:    '0',
          metadata:      signed.metadata,
          builder:       signed.builder,
          signature:     signed.signature,
        },
        owner:     this.apiKey,
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

  /**
   * Returns the wallet address used for HMAC auth (POLY_ADDRESS).
   * For EOA mode this equals the L1 signer; for PROXY mode it's the proxy.
   */
  getWalletAddress(): string {
    return this.walletAddress;
  }

  /**
   * Approve USDC.e for the 3 Polymarket exchange contracts on Polygon.
   * Idempotent: skips contracts where allowance is already effectively MAX.
   *
   * Without this, /balance-allowance returns min(balance, allowance) = 0 for any
   * deposit, and the bot sees zero buying power. Required to unlock trading the
   * very first time the wallet is used. Subsequent restarts are no-ops.
   *
   * Skipped in DRY_RUN mode and when no L1 wallet is configured.
   * Approval txs are sent from the L1 EOA, so this is meaningful only in EOA mode
   * (POLY_PROXY mode would need a separate flow — proxy holds USDC, not L1).
   */
  async ensureAllowances(): Promise<void> {
    if (this.dryRun) {
      console.log('[order-manager] ensureAllowances skipped (DRY_RUN)');
      return;
    }
    if (!this.l1Wallet) {
      console.warn('[order-manager] ensureAllowances skipped: no L1 wallet (set POLYARB_WALLET_PRIVATE_KEY)');
      return;
    }
    const provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137, { staticNetwork: ethers.Network.from(137) });
    const wallet   = this.l1Wallet.connect(provider);
    const owner    = await wallet.getAddress();
    const HALF_MAX = ethers.MaxUint256 / 2n;

    // V2 (April 2026) switched collateral USDC.e → pUSD. Both must be approved:
    // USDC.e for legacy V1 markets still active, pUSD for all V2 CLOB orders.
    const TOKENS = [
      { name: 'USDC.e', address: USDC_E },
      { name: 'pUSD',   address: PUSD   },
    ] as const;

    for (const { name: tokenName, address: tokenAddress } of TOKENS) {
      const erc20 = new ethers.Contract(tokenAddress, ERC20_APPROVE_ABI, wallet);
      console.log(`[order-manager] ensureAllowances: checking ${tokenName} allowances for ${owner}`);
      for (const { name, address } of POLYMARKET_SPENDERS) {
        try {
          const current = await erc20.allowance!(owner, address) as bigint;
          if (current >= HALF_MAX) {
            console.log(`[order-manager] ${tokenName} allowance OK for ${name} (${address.slice(0, 10)}…)`);
            continue;
          }
          console.warn(`[order-manager] Approving ${tokenName} for ${name} — current=${current.toString()}`);
          // Polygon mainnet is currently sustaining ~180 gwei base + 76 gwei tip
          // (post-Bhilai upgrade). Use 'latest' nonce to replace any stuck pending
          // tx from previous failed attempts (RBF). 400/150 gwei guarantees inclusion.
          // Gas cost: 100k gas * 400 gwei = 0.04 MATIC ≈ $0.02 per approve.
          const nonce = await provider.getTransactionCount(owner, 'latest');
          const tx = await erc20.approve!(address, ethers.MaxUint256, {
            maxFeePerGas:         ethers.parseUnits('400', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('150', 'gwei'),
            gasLimit:             100_000n,
            nonce,
          });
          console.log(`[order-manager] approve tx submitted — token=${tokenName} hash=${tx.hash} nonce=${nonce}`);
          const receipt = await tx.wait();
          console.log(`[order-manager] Approved ${tokenName} for ${name} — tx=${receipt?.hash ?? 'n/a'} block=${receipt?.blockNumber}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[order-manager] Approve failed for ${tokenName}/${name}: ${msg.slice(0, 200)}`);
          throw err;
        }
      }
    }
    console.log('[order-manager] ensureAllowances complete');
  }
}
