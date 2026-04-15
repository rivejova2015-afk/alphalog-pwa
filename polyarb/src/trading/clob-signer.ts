/**
 * Polymarket CLOB EIP-712 Order Signer
 *
 * Signs orders using the EIP-712 typed data standard required by the
 * Polymarket CTF Exchange contract on Polygon mainnet.
 *
 * References:
 *  - Contract: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E (Polygon)
 *  - Chain: 137 (Polygon mainnet)
 *  - Docs: https://docs.polymarket.com/
 */

import { ethers } from 'ethers';

// Polymarket CTF Exchange on Polygon mainnet
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CHAIN_ID = 137;

const DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: CTF_EXCHANGE,
} as const;

import type { TypedDataField } from 'ethers';

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

// Side enum
export const Side = { BUY: 0, SELL: 1 } as const;

// Signature type: 0 = EOA
const SIGNATURE_TYPE_EOA = 0;

// Zero address (taker = open order)
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// USDC decimals on Polygon
const USDC_DECIMALS = 6;

export interface ClobOrderParams {
  tokenId: string;     // YES or NO token ID
  side: 0 | 1;        // Side.BUY or Side.SELL
  price: number;       // Limit price 0–1 (e.g. 0.65)
  sizeUsd: number;     // Size in USD
  feeRateBps: number;
}

export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

export class ClobSigner {
  private wallet: ethers.Wallet;

  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }

  get address(): string {
    return this.wallet.address;
  }

  /**
   * Build and sign an EIP-712 order for the Polymarket CLOB.
   *
   * For a BUY order:
   *   makerAmount = sizeUsd * 10^6  (USDC the maker gives)
   *   takerAmount = shares = sizeUsd / price * 10^6
   *
   * For a SELL order:
   *   makerAmount = shares to sell * 10^6
   *   takerAmount = USDC to receive * 10^6
   */
  async signOrder(params: ClobOrderParams): Promise<SignedOrder> {
    const { tokenId, side, price, sizeUsd, feeRateBps } = params;

    const makerAmountRaw = BigInt(Math.round(sizeUsd * 10 ** USDC_DECIMALS));
    const takerAmountRaw =
      side === Side.BUY
        ? BigInt(Math.round((sizeUsd / price) * 10 ** USDC_DECIMALS))
        : BigInt(Math.round(sizeUsd * 10 ** USDC_DECIMALS));

    const salt = BigInt(Date.now()).toString();
    const nonce = '0';
    const expiration = '0'; // 0 = no expiration (GTC)

    const orderData = {
      salt,
      maker:         this.wallet.address,
      signer:        this.wallet.address,
      taker:         ZERO_ADDRESS,
      tokenId:       BigInt(tokenId).toString(),
      makerAmount:   makerAmountRaw.toString(),
      takerAmount:   takerAmountRaw.toString(),
      expiration,
      nonce,
      feeRateBps:    feeRateBps.toString(),
      side,
      signatureType: SIGNATURE_TYPE_EOA,
    };

    const signature = await this.wallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);

    return {
      salt,
      maker:         this.wallet.address,
      signer:        this.wallet.address,
      taker:         ZERO_ADDRESS,
      tokenId:       BigInt(tokenId).toString(),
      makerAmount:   makerAmountRaw.toString(),
      takerAmount:   takerAmountRaw.toString(),
      expiration,
      nonce,
      feeRateBps:    feeRateBps.toString(),
      side,
      signatureType: SIGNATURE_TYPE_EOA,
      signature,
    };
  }
}
