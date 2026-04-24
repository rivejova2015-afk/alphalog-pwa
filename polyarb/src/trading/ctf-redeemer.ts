/**
 * CTF Redeemer — redeems resolved Polymarket conditional tokens on-chain.
 *
 * After a 5-minute market resolves, YES/NO tokens sit in the CTF Exchange
 * contract. This module calls redeemPositions() on Polygon to convert them
 * back to USDC.
 *
 * Partition encoding (Gnosis CTF standard):
 *   YES outcome → indexSet [2]  (bit 1 set: binary 10)
 *   NO  outcome → indexSet [1]  (bit 0 set: binary 01)
 */

import { ethers } from 'ethers';
import { getSupabase } from '../supabase.js';

const CTF_EXCHANGE          = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const USDC_POLYGON          = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const ZERO_BYTES32          = '0x' + '0'.repeat(64);
const POLYGON_RPC           = process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com';

const CTF_ABI = [
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external',
];

const USDC_ABI = [
  'function balanceOf(address account) view returns (uint256)',
];

export interface RedeemResult {
  redeemed: boolean;
  amountUsd: number;
  txHash: string | null;
  error?: string;
}

export class CtfRedeemer {
  private wallet: ethers.Wallet | null = null;
  private provider: ethers.JsonRpcProvider;
  private dryRun: boolean;

  constructor(privateKey: string | null | undefined, dryRun: boolean) {
    this.dryRun = dryRun;
    this.provider = new ethers.JsonRpcProvider(POLYGON_RPC);
    if (!dryRun && privateKey) {
      const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(pk, this.provider);
      console.log(`[ctf-redeemer] Wallet: ${this.wallet.address}`);
    } else if (!dryRun) {
      console.warn('[ctf-redeemer] No private key — redemptions will be skipped in LIVE mode');
    }
  }

  /**
   * Redeem conditional tokens for a resolved market position.
   * In DRY_RUN: skips the on-chain tx but still queries gamma for winner.
   */
  async redeem(params: {
    conditionId: string;
    outcome: 'YES' | 'NO';
    negRisk?: boolean;
    positionId: string;
  }): Promise<RedeemResult> {
    const { conditionId, outcome, negRisk, positionId } = params;
    const contractAddress = negRisk ? NEG_RISK_CTF_EXCHANGE : CTF_EXCHANGE;
    const indexSets = outcome === 'YES' ? [2n] : [1n];

    if (this.dryRun) {
      console.log(`[ctf-redeemer] [DRY_RUN] Would redeem ${outcome} tokens for conditionId ${conditionId.slice(0, 12)}...`);
      await this.markRedeemed(positionId, 0, null);
      return { redeemed: true, amountUsd: 0, txHash: null };
    }

    if (!this.wallet) {
      return { redeemed: false, amountUsd: 0, txHash: null, error: 'No wallet configured' };
    }

    try {
      const usdc = new ethers.Contract(USDC_POLYGON, USDC_ABI, this.provider);
      const balanceBefore = BigInt(await usdc.balanceOf(this.wallet.address));

      const ctf = new ethers.Contract(contractAddress, CTF_ABI, this.wallet);
      const tx = await ctf.redeemPositions(
        USDC_POLYGON,
        ZERO_BYTES32,
        conditionId,
        indexSets,
        { gasLimit: 200_000 },
      ) as ethers.TransactionResponse;

      console.log(`[ctf-redeemer] Redeem tx sent: ${tx.hash}`);
      const receipt = await tx.wait(1);

      const balanceAfter = BigInt(await usdc.balanceOf(this.wallet.address));
      const delta = balanceAfter - balanceBefore;
      const amountUsd = Number(delta) / 1e6;

      console.log(`[ctf-redeemer] Redeemed $${amountUsd.toFixed(4)} USDC (tx: ${tx.hash}) status=${receipt?.status}`);
      await this.markRedeemed(positionId, amountUsd, tx.hash);

      return { redeemed: true, amountUsd, txHash: tx.hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ctf-redeemer] Redeem failed for ${conditionId.slice(0, 12)}: ${msg}`);
      return { redeemed: false, amountUsd: 0, txHash: null, error: msg };
    }
  }

  /** Read on-chain USDC balance for the configured wallet. */
  async fetchWalletBalance(): Promise<number | null> {
    if (!this.wallet) return null;
    try {
      const usdc = new ethers.Contract(USDC_POLYGON, USDC_ABI, this.provider);
      const raw = BigInt(await usdc.balanceOf(this.wallet.address));
      return Number(raw) / 1e6;
    } catch {
      return null;
    }
  }

  private async markRedeemed(positionId: string, amountUsd: number, txHash: string | null): Promise<void> {
    const supabase = getSupabase();
    await supabase
      .from('polyarb_positions')
      .update({ redeemed: true, redeemed_at: new Date().toISOString(), redeemed_usd: amountUsd, redeem_tx_hash: txHash })
      .eq('id', positionId);
  }
}
