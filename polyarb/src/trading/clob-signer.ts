/**
 * Polymarket CLOB V2 EIP-712 Order Signer
 *
 * V2 migration (2026-04-28): Polymarket bumped exchange domain version "1"→"2",
 * deployed new exchange contracts, and restructured the Order struct.
 * Removed fields: taker, expiration, nonce, feeRateBps.
 * Added fields:   timestamp (ms), metadata (bytes32), builder (bytes32).
 * `expiration` still appears in the POST /order wire body (not signed).
 *
 * Two signing modes:
 *
 * EOA (signatureType=0):
 *   - maker = signer = wallet address
 *   - Signs with wallet private key (POLYARB_WALLET_PRIVATE_KEY)
 *
 * POLY_PROXY (signatureType=1):
 *   - maker = main wallet address (proxy)
 *   - signer = api_key address (the L2 key Polymarket generated)
 *   - Signs with api_secret (the L2 private key)
 *
 * References:
 *   - https://docs.polymarket.com/v2-migration
 *   - V2 contract (regular): 0xE111180000d2663C0091e4f400237545B87B996B (Polygon)
 *   - V2 contract (negRisk): 0xe2222d279d744050d28e00520010520000310F59 (Polygon)
 *   - Chain: 137 (Polygon mainnet)
 */

import { ethers, type TypedDataField } from 'ethers';

// V2 exchange contracts (replaced V1 0x4bFb41d5... and 0xC5d563A3...)
const CTF_EXCHANGE_V2          = '0xE111180000d2663C0091e4f400237545B87B996B';
const NEG_RISK_CTF_EXCHANGE_V2 = '0xe2222d279d744050d28e00520010520000310F59';
const CHAIN_ID = 137;

// bytes32 zero — default for unused metadata/builder fields
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

function buildDomain(negRisk: boolean) {
  return {
    name: 'Polymarket CTF Exchange',
    version: '2',
    chainId: CHAIN_ID,
    verifyingContract: negRisk ? NEG_RISK_CTF_EXCHANGE_V2 : CTF_EXCHANGE_V2,
  };
}

const ORDER_TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
    { name: 'timestamp',     type: 'uint256' },
    { name: 'metadata',      type: 'bytes32' },
    { name: 'builder',       type: 'bytes32' },
  ],
};

export const Side = { BUY: 0, SELL: 1 } as const;

const SIGNATURE_TYPE_EOA        = 0;
const SIGNATURE_TYPE_POLY_PROXY = 1;

const USDC_DECIMALS = 6;

export interface ClobOrderParams {
  tokenId:    string;
  side:       0 | 1;
  price:      number;
  sizeUsd:    number;
  /** Deprecated under V2 (no longer in EIP-712 struct). Kept for call-site compat; ignored. */
  feeRateBps?: number;
  negRisk?:   boolean;
}

export interface SignedOrder {
  salt:          string;
  maker:         string;
  signer:        string;
  tokenId:       string;
  makerAmount:   string;
  takerAmount:   string;
  side:          number;
  signatureType: number;
  timestamp:     string;
  metadata:      string;
  builder:       string;
  signature:     string;
}

// ─── EOA mode ─────────────────────────────────────────────────────────────────

export class ClobSigner {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  get address(): string { return this.wallet.address; }

  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    return signEip712(params, this.wallet, this.wallet.address, SIGNATURE_TYPE_EOA, params.negRisk ?? false);
  }
}

// Accepts 64-char hex (with/without 0x) OR base64/base64url-encoded 32 bytes.
function toEthPrivateKey(secret: string): string {
  const stripped = secret.startsWith('0x') ? secret.slice(2) : secret;
  if (/^[0-9a-fA-F]{64}$/.test(stripped)) return `0x${stripped}`;
  const b64 = stripped.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Buffer.from(b64, 'base64');
  return `0x${bytes.toString('hex')}`;
}

// ─── POLY_PROXY mode ──────────────────────────────────────────────────────────

export class ClobProxySigner {
  private wallet:       ethers.Wallet;
  private proxyAddress: string;

  constructor(privateKey: string, proxyAddress: string) {
    this.wallet       = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    this.proxyAddress = proxyAddress;
  }

  get signerAddress(): string { return this.wallet.address; }
  get makerAddr():    string  { return this.proxyAddress; }

  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    return signEip712(params, this.wallet, this.proxyAddress, SIGNATURE_TYPE_POLY_PROXY, params.negRisk ?? false);
  }
}

export class ClobL2Signer {
  private l2Wallet:     ethers.Wallet;
  private makerAddress: string;

  constructor(makerAddress: string, apiSecret: string) {
    this.l2Wallet     = new ethers.Wallet(toEthPrivateKey(apiSecret));
    this.makerAddress = makerAddress;
  }

  get signerAddress(): string  { return this.l2Wallet.address; }
  get makerAddr():    string   { return this.makerAddress; }

  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    return signEip712(params, this.l2Wallet, this.makerAddress, SIGNATURE_TYPE_POLY_PROXY, params.negRisk ?? false);
  }
}

// ─── Shared EIP-712 logic ─────────────────────────────────────────────────────

async function signEip712(
  params:        ClobOrderParams,
  signerWallet:  ethers.Wallet,
  makerAddress:  string,
  signatureType: number,
  negRisk:       boolean,
): Promise<SignedOrder> {
  const { tokenId, side, price, sizeUsd } = params;
  const DOMAIN = buildDomain(negRisk);

  // Shares-first calculation — mirrors @polymarket/clob-client getOrderRawAmounts.
  // BUY:  makerAmt = USDC spent, takerAmt = shares received
  // SELL: makerAmt = shares sold, takerAmt = USDC received
  const priceRounded  = Math.round(price * 1000) / 1000;
  const sharesRounded = Math.floor((sizeUsd / priceRounded) * 100) / 100;
  const usdcRounded   = Math.round(sharesRounded * priceRounded * 100000) / 100000;

  const makerAmountRaw =
    side === Side.BUY
      ? BigInt(Math.round(usdcRounded   * 10 ** USDC_DECIMALS))
      : BigInt(Math.round(sharesRounded * 10 ** USDC_DECIMALS));
  const takerAmountRaw =
    side === Side.BUY
      ? BigInt(Math.round(sharesRounded * 10 ** USDC_DECIMALS))
      : BigInt(Math.round(usdcRounded   * 10 ** USDC_DECIMALS));

  const nowMs     = Date.now();
  const salt      = BigInt(nowMs).toString();
  const timestamp = String(nowMs);

  const orderData = {
    salt,
    maker:         makerAddress,
    signer:        signerWallet.address,
    tokenId:       BigInt(tokenId).toString(),
    makerAmount:   makerAmountRaw.toString(),
    takerAmount:   takerAmountRaw.toString(),
    side,
    signatureType,
    timestamp,
    metadata: ZERO_BYTES32,
    builder:  ZERO_BYTES32,
  };

  const signature = await signerWallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);

  return { ...orderData, signature };
}
