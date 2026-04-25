/**
 * CTF Redeemer — redeems resolved Polymarket outcome tokens on-chain.
 *
 * For standard binary markets (negRisk=false, btc-updown-5m):
 *   CTF.redeemPositions(pUSD, bytes32(0), conditionId, indexSets)
 *   Contract: 0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E
 *
 *   YES outcome → indexSet [2]  (bit 1: binary 10)
 *   NO  outcome → indexSet [1]  (bit 0: binary 01)
 *
 * Requires ~0.02 POL per redemption for gas. EOA wallet must hold the tokens.
 */

import { ethers } from 'ethers';
import { getSupabase } from '../supabase.js';

// Gnosis Conditional Token Framework — holds ERC1155 outcome tokens on Polygon
const CTF_EXCHANGE  = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const PUSD          = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB'; // Polymarket USD (newest collateral)
const USDC_NATIVE   = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC on Polygon (2024+)
const USDC_E        = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e bridged (legacy)
const ZERO_BYTES32  = '0x' + '0'.repeat(64);
const POLYGON_RPC   = process.env.POLYGON_RPC_URL ?? 'https://polygon.api.onfinality.io/public';

const CTF_ABI = [
  // ERC1155
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  // Standard Gnosis CTF redemption — burns entire balance for this conditionId
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external',
];

const ERC20_ABI = [
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
    // staticNetwork avoids chain-ID detection spam in logs (Polygon = chainId 137)
    this.provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137, { staticNetwork: ethers.Network.from(137) });
    if (!dryRun && privateKey) {
      const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(pk, this.provider);
      console.log(`[ctf-redeemer] Wallet: ${this.wallet.address} RPC: ${POLYGON_RPC}`);
    } else if (!dryRun) {
      console.warn('[ctf-redeemer] No private key — on-chain redemptions disabled');
    }
  }

  get walletAddress(): string | null {
    return this.wallet?.address ?? null;
  }

  /**
   * Redeem standard CTF binary outcome tokens.
   *
   * Calls CTF.redeemPositions(pUSD, 0, conditionId, indexSets).
   * Token balance is checked on-chain first — if zero, marks done and returns.
   *
   * @param conditionId  bytes32 condition ID (from DB / gamma API)
   * @param outcome      'YES' or 'NO' — determines indexSet used
   * @param tokenId      ERC1155 token ID for the outcome (clobTokenIds[0 or 1])
   * @param positionId   DB position ID (for marking redeemed)
   */
  async redeemPosition(params: {
    conditionId: string;
    outcome: 'YES' | 'NO';
    tokenId: string;    // decimal token ID from gamma API clobTokenIds
    positionId: string;
  }): Promise<RedeemResult> {
    const { conditionId, outcome, tokenId, positionId } = params;

    if (this.dryRun) {
      console.log(`[ctf-redeemer] [DRY_RUN] redeem ${outcome} conditionId=${conditionId.slice(0, 14)}...`);
      await this.markRedeemed(positionId);
      return { redeemed: true, amountUsd: 0, txHash: null };
    }

    if (!this.wallet) {
      return { redeemed: false, amountUsd: 0, txHash: null, error: 'No wallet' };
    }

    try {
      const ctf = new ethers.Contract(CTF_EXCHANGE, CTF_ABI, this.wallet);
      const walletAddr = this.wallet.address;

      // Check ERC1155 balance of this outcome token
      const balance = (await ctf.balanceOf(walletAddr, BigInt(tokenId))) as bigint;
      console.log(`[ctf-redeemer] Balance ${outcome} token=${tokenId.slice(0, 12)}... balance=${balance}`);

      if (balance === 0n) {
        console.log(`[ctf-redeemer] No tokens in wallet for ${conditionId.slice(0, 14)}... — marking done`);
        await this.markRedeemed(positionId);
        return { redeemed: true, amountUsd: 0, txHash: null };
      }

      // Snapshot all collateral balances before redemption
      // Polymarket has used 3 different collaterals: pUSD (newest), native USDC (2024), USDC.e (legacy)
      const pusd       = new ethers.Contract(PUSD,        ERC20_ABI, this.provider);
      const usdcNative = new ethers.Contract(USDC_NATIVE, ERC20_ABI, this.provider);
      const usdce      = new ethers.Contract(USDC_E,      ERC20_ABI, this.provider);
      const [pusdBefore, usdcNativeBefore, usdceBefore]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);
      console.log(`[ctf-redeemer] Balances before — pUSD: ${pusdBefore} | USDC: ${usdcNativeBefore} | USDC.e: ${usdceBefore}`);

      // Try each collateral in sequence: pUSD → native USDC → USDC.e
      // The CTF stores collateral per-condition; passing wrong address causes revert
      // Redeem both slots — CTF pays only the won outcome, ignores the other (balance=0)
      // Avoids hardcoding YES/NO→indexSet mapping which varies by market registration order
      const indexSets = [1n, 2n];
      const collaterals = [
        { address: PUSD,        name: 'pUSD'   },
        { address: USDC_NATIVE, name: 'USDC'   },
        { address: USDC_E,      name: 'USDC.e' },
      ];

      let tx: ethers.TransactionResponse | null = null;
      let usedCollateral = 'unknown';
      for (const col of collaterals) {
        try {
          console.log(`[ctf-redeemer] Trying collateral ${col.name} (${col.address.slice(0, 10)}...)`);
          tx = await (ctf.redeemPositions(
            col.address, ZERO_BYTES32, conditionId, indexSets,
            { gasLimit: 300_000 },
          ) as Promise<ethers.TransactionResponse>);
          usedCollateral = col.name;
          break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log(`[ctf-redeemer] ${col.name} reverted: ${msg.slice(0, 80)}`);
        }
      }
      if (!tx) throw new Error('All collateral attempts reverted');

      console.log(`[ctf-redeemer] Tx sent (${usedCollateral}): ${tx.hash}`);
      const receipt = await tx.wait(1);

      const [pusdAfter, usdcNativeAfter, usdceAfter]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);
      const deltaPusd   = pusdAfter   - pusdBefore;
      const deltaUsdc   = usdcNativeAfter - usdcNativeBefore;
      const deltaUsdce  = usdceAfter  - usdceBefore;
      console.log(`[ctf-redeemer] Deltas — pUSD: ${deltaPusd} | USDC: ${deltaUsdc} | USDC.e: ${deltaUsdce}`);
      const amountUsd = Number(deltaPusd + deltaUsdc + deltaUsdce) / 1e6;

      console.log(`[ctf-redeemer] Redeemed $${amountUsd.toFixed(4)} ${usedCollateral} | tx: ${tx.hash} status=${receipt?.status}`);
      await this.markRedeemed(positionId);

      return { redeemed: true, amountUsd, txHash: tx.hash };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ctf-redeemer] redeemPosition failed ${conditionId.slice(0, 14)}...: ${msg}`);
      return { redeemed: false, amountUsd: 0, txHash: null, error: msg };
    }
  }

  private async markRedeemed(positionId: string): Promise<void> {
    const supabase = getSupabase();
    await supabase
      .from('polyarb_positions')
      .update({ redeemed: true, redeemed_at: new Date().toISOString() })
      .eq('id', positionId);
  }
}
