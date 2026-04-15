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

const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CHAIN_ID = 137;

const DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: CTF_EXCHANGE,
} as const;

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
    return signEip712(params, this.wallet, this.wallet.address, SIGNATURE_TYPE_EOA);
  }
}

// ─── POLY_PROXY mode ──────────────────────────────────────────────────────────
// Uses the L2 API credentials Polymarket generated.
// maker  = main wallet address stored in DB
// signer = api_key address (the L2 Ethereum address)
// signs  = api_secret (the L2 private key, 64-char hex)

export class ClobL2Signer {
  private l2Wallet:     ethers.Wallet;
  private makerAddress: string;

  /**
   * @param makerAddress  Main wallet address (0xbf57... from polyarb_agents)
   * @param apiSecret     POLY-SECRET — must be a 64-char hex Ethereum private key
   */
  constructor(makerAddress: string, apiSecret: string) {
    // Normalise: Polymarket secrets may omit the 0x prefix
    const key = apiSecret.startsWith('0x') ? apiSecret : `0x${apiSecret}`;
    this.l2Wallet     = new ethers.Wallet(key);
    this.makerAddress = makerAddress;
  }

  get signerAddress(): string  { return this.l2Wallet.address; }
  get makerAddr():    string   { return this.makerAddress; }

  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    return signEip712(params, this.l2Wallet, this.makerAddress, SIGNATURE_TYPE_POLY_PROXY);
  }
}

// ─── Shared EIP-712 logic ─────────────────────────────────────────────────────

async function signEip712(
  params:        ClobOrderParams,
  signerWallet:  ethers.Wallet,
  makerAddress:  string,
  signatureType: number,
): Promise<SignedOrder> {
  const { tokenId, side, price, sizeUsd, feeRateBps } = params;

  const makerAmountRaw = BigInt(Math.round(sizeUsd * 10 ** USDC_DECIMALS));
  const takerAmountRaw =
    side === Side.BUY
      ? BigInt(Math.round((sizeUsd / price) * 10 ** USDC_DECIMALS))
      : BigInt(Math.round(sizeUsd * 10 ** USDC_DECIMALS));

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
