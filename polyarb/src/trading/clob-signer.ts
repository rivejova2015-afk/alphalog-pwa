/**
 * Polymarket CLOB EIP-712 Order Signer
 *
 * Two signing modes:
 *
 * EOA (signatureType=0):
 *   - maker = signer = wallet address
 *   - Signs with wallet private key (POLYARB_WALLET_PRIVATE_KEY)
 *
 * POLY_PROXY (signatureType=1):
 *   - maker = main wallet address (0xbf57...)
 *   - signer = api_key address (the L2 key Polymarket generated)
 *   - Signs with api_secret (the L2 private key)
 *   - No main wallet private key needed
 *
 * References:
 *  - Contract: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E (Polygon)
 *  - Chain: 137 (Polygon mainnet)
 */

import { ethers, type TypedDataField } from 'ethers';

const CTF_EXCHANGE          = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const CHAIN_ID = 137;

function buildDomain(negRisk: boolean) {
  return {
    name: 'Polymarket CTF Exchange',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE,
  };
}

const ORDER_TYPES: Record<string, TypedDataField[]> = {
  Order: [
    { name: 'salt',          type: 'uint256' },
    { name: 'maker',         type: 'address' },
    { name: 'signer',        type: 'address' },
    { name: 'taker',         type: 'address' },
    { name: 'tokenId',       type: 'uint256' },
    { name: 'makerAmount',   type: 'uint256' },
    { name: 'takerAmount',   type: 'uint256' },
    { name: 'expiration',    type: 'uint256' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'feeRateBps',    type: 'uint256' },
    { name: 'side',          type: 'uint8'   },
    { name: 'signatureType', type: 'uint8'   },
  ],
};

export const Side = { BUY: 0, SELL: 1 } as const;

const SIGNATURE_TYPE_EOA        = 0;
const SIGNATURE_TYPE_POLY_PROXY = 1;

const ZERO_ADDRESS  = '0x0000000000000000000000000000000000000000';
const USDC_DECIMALS = 6;

export interface ClobOrderParams {
  tokenId:    string;
  side:       0 | 1;
  price:      number;
  sizeUsd:    number;
  feeRateBps: number;
  negRisk?:   boolean;
}

export interface SignedOrder {
  salt:          string;
  maker:         string;
  signer:        string;
  taker:         string;
  tokenId:       string;
  makerAmount:   string;
  takerAmount:   string;
  expiration:    string;
  nonce:         string;
  feeRateBps:    string;
  side:          number;
  signatureType: number;
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
  // base64url → base64 → bytes → hex
  const b64 = stripped.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Buffer.from(b64, 'base64');
  return `0x${bytes.toString('hex')}`;
}

// ─── POLY_PROXY mode ──────────────────────────────────────────────────────────
// maker  = proxy wallet address (holds USDC on CTF Exchange)
// signer = MetaMask EOA (owns the API key, signs the EIP-712 order)
// api_secret is used ONLY for L2 HMAC auth headers — NOT for signing orders.

export class ClobProxySigner {
  private wallet:       ethers.Wallet;  // MetaMask EOA wallet
  private proxyAddress: string;         // proxy wallet (maker field)

  /**
   * @param privateKey     MetaMask EOA private key (POLYARB_WALLET_PRIVATE_KEY)
   * @param proxyAddress   Proxy wallet address from polyarb_agents.wallet_address
   */
  constructor(privateKey: string, proxyAddress: string) {
    this.wallet       = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    this.proxyAddress = proxyAddress;
  }

  get signerAddress(): string { return this.wallet.address; }  // MetaMask EOA
  get makerAddr():    string  { return this.proxyAddress; }

  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    return signEip712(params, this.wallet, this.proxyAddress, SIGNATURE_TYPE_POLY_PROXY, params.negRisk ?? false);
  }
}

// Kept for reference — NOT used for order signing (api_secret is HMAC-only).
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
  const { tokenId, side, price, sizeUsd, feeRateBps } = params;
  const DOMAIN = buildDomain(negRisk);

  // Shares-first calculation — mirrors @polymarket/clob-client getOrderRawAmounts.
  // BUY:  makerAmt = USDC spent, takerAmt = shares received
  // SELL: makerAmt = shares sold, takerAmt = USDC received
  // Round price to 3 dp (0.001 tick — covers all Polymarket tick sizes).
  // Round shares DOWN to 2 dp so makerAmt/takerAmt ratio lands exactly on tick grid.
  const priceRounded = Math.round(price * 1000) / 1000;
  const sharesRounded = Math.floor((sizeUsd / priceRounded) * 100) / 100;
  const usdcRounded   = Math.round(sharesRounded * priceRounded * 100000) / 100000;

  const makerAmountRaw =
    side === Side.BUY
      ? BigInt(Math.round(usdcRounded   * 10 ** USDC_DECIMALS))  // USDC out
      : BigInt(Math.round(sharesRounded * 10 ** USDC_DECIMALS)); // shares out
  const takerAmountRaw =
    side === Side.BUY
      ? BigInt(Math.round(sharesRounded * 10 ** USDC_DECIMALS))  // shares in
      : BigInt(Math.round(usdcRounded   * 10 ** USDC_DECIMALS)); // USDC in

  const salt       = BigInt(Date.now()).toString();
  const nonce      = '0';
  const expiration = '0';

  const orderData = {
    salt,
    maker:         makerAddress,
    signer:        signerWallet.address,
    taker:         ZERO_ADDRESS,
    tokenId:       BigInt(tokenId).toString(),
    makerAmount:   makerAmountRaw.toString(),
    takerAmount:   takerAmountRaw.toString(),
    expiration,
    nonce,
    feeRateBps:    feeRateBps.toString(),
    side,
    signatureType,
  };

  const signature = await signerWallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);

  return { ...orderData, signature };
}
