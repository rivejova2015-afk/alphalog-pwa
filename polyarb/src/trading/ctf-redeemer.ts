/**
 * CTF Redeemer — redeems resolved Polymarket outcome tokens on-chain.
 *
 * Two paths depending on market type:
 *
 *   A) Standard binary (negRisk=false) — Gnosis CTF directly:
 *        CTF.redeemPositions(collateral, bytes32(0), conditionId, indexSets)
 *        Tries pUSD → USDC → USDC.e until one stops reverting.
 *
 *   B) NegRisk (btc-updown-5m, multi-outcome) — must go via NegRiskAdapter:
 *        NegRiskAdapter.redeemPositions(conditionId, [yesAmount, noAmount])
 *        Adapter burns the position tokens and unwraps WCOL → USDC to wallet.
 *        Requires CTF.setApprovalForAll(NegRiskAdapter, true) one time.
 *
 * Polymarket's btc-updown-5m markets are NegRisk. Calling path (A) on them
 * succeeds on-chain (status=1) but pays $0 because the conditionId isn't a
 * standard CTF condition — that previously burned won tokens silently. The
 * `markRedeemed` guard now only commits the DB flag when amount > 0 OR
 * balance was 0 (nothing to redeem), so silent failures are retried instead
 * of permanently flagged as redeemed.
 *
 * Requires ~0.02 POL per redemption for gas. EOA wallet must hold the tokens.
 */

import { ethers } from 'ethers';
import { getSupabase } from '../supabase.js';

// Standard Gnosis Conditional Tokens framework on Polygon — holds ERC1155 outcome tokens
const CTF_FRAMEWORK     = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
// NegRiskAdapter wraps CTF for multi-outcome markets (btc-updown-5m, election markets)
const NEG_RISK_ADAPTER  = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

const PUSD          = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB'; // Polymarket USD (newest collateral)
const USDC_NATIVE   = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native USDC on Polygon (2024+)
const USDC_E        = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e bridged (legacy)
const ZERO_BYTES32  = '0x' + '0'.repeat(64);
const POLYGON_RPC   = process.env.POLYGON_RPC_URL ?? 'https://polygon.api.onfinality.io/public';

const CTF_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved) external',
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata indexSets) external',
];

const NEG_RISK_ADAPTER_ABI = [
  // _amounts.length == 2 always: [yesAmount, noAmount]
  'function redeemPositions(bytes32 _conditionId, uint256[] calldata _amounts) public',
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
  private negRiskApprovalChecked = false;

  constructor(privateKey: string | null | undefined, dryRun: boolean) {
    this.dryRun = dryRun;
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
   * Redeem resolved outcome tokens for USDC.
   *
   * @param conditionId    bytes32 condition ID (from DB / gamma API)
   * @param outcome        'YES' or 'NO' (the position's outcome — used only for logging)
   * @param tokenId        ERC1155 token ID for the won outcome
   * @param loserTokenId   ERC1155 token ID for the lost outcome (required for NegRisk path)
   * @param positionId     DB position ID (for marking redeemed)
   * @param negRisk        true → route via NegRiskAdapter; false → standard CTF
   */
  async redeemPosition(params: {
    conditionId: string;
    outcome: 'YES' | 'NO';
    tokenId: string;
    loserTokenId?: string;
    positionId: string;
    negRisk?: boolean;
  }): Promise<RedeemResult> {
    const { conditionId, outcome, tokenId, loserTokenId, positionId, negRisk = false } = params;

    if (this.dryRun) {
      console.log(`[ctf-redeemer] [DRY_RUN] redeem ${outcome} negRisk=${negRisk} conditionId=${conditionId.slice(0, 14)}...`);
      await this.markRedeemed(positionId);
      return { redeemed: true, amountUsd: 0, txHash: null };
    }

    if (!this.wallet) {
      return { redeemed: false, amountUsd: 0, txHash: null, error: 'No wallet' };
    }

    return negRisk
      ? this.redeemNegRisk({ conditionId, outcome, tokenId, loserTokenId, positionId })
      : this.redeemStandardCtf({ conditionId, outcome, tokenId, positionId });
  }

  /**
   * NegRisk path — call NegRiskAdapter.redeemPositions(conditionId, [yes, no]).
   * The adapter burns position tokens and pays USDC to the wallet.
   */
  private async redeemNegRisk(params: {
    conditionId: string;
    outcome: 'YES' | 'NO';
    tokenId: string;
    loserTokenId?: string;
    positionId: string;
  }): Promise<RedeemResult> {
    const { conditionId, outcome, tokenId, loserTokenId, positionId } = params;
    const wallet = this.wallet!;
    const walletAddr = wallet.address;

    try {
      const ctf = new ethers.Contract(CTF_FRAMEWORK, CTF_ABI, wallet);
      const adapter = new ethers.Contract(NEG_RISK_ADAPTER, NEG_RISK_ADAPTER_ABI, wallet);

      // YES outcome's tokenId is at index 0 of clobTokenIds, NO at index 1.
      // The position's `tokenId` is the WON one; loserTokenId is the LOST one.
      // _amounts must be [yesAmount, noAmount] regardless of which was won.
      const wonBalance = (await ctf.balanceOf(walletAddr, BigInt(tokenId))) as bigint;
      const loserBalance: bigint = loserTokenId
        ? ((await ctf.balanceOf(walletAddr, BigInt(loserTokenId))) as bigint)
        : 0n;

      console.log(`[ctf-redeemer] NegRisk balances — won(${outcome})=${wonBalance} loser=${loserBalance}`);

      if (wonBalance === 0n && loserBalance === 0n) {
        console.log(`[ctf-redeemer] No tokens for ${conditionId.slice(0, 14)}... — marking done`);
        await this.markRedeemed(positionId);
        return { redeemed: true, amountUsd: 0, txHash: null };
      }

      const yesAmount = outcome === 'YES' ? wonBalance : loserBalance;
      const noAmount  = outcome === 'YES' ? loserBalance : wonBalance;

      // Adapter must be approved to burn the wallet's CTF position tokens.
      // First-call check, cached for the process lifetime.
      if (!this.negRiskApprovalChecked) {
        const approved = (await ctf.isApprovedForAll(walletAddr, NEG_RISK_ADAPTER)) as boolean;
        if (!approved) {
          console.log('[ctf-redeemer] Granting NegRiskAdapter approval on CTF (one-time)…');
          const approveTx = await (ctf.setApprovalForAll(NEG_RISK_ADAPTER, true, { gasLimit: 80_000 }) as Promise<ethers.TransactionResponse>);
          await approveTx.wait(1);
          console.log(`[ctf-redeemer] Approval granted: ${approveTx.hash}`);
        }
        this.negRiskApprovalChecked = true;
      }

      const pusd       = new ethers.Contract(PUSD,        ERC20_ABI, this.provider);
      const usdcNative = new ethers.Contract(USDC_NATIVE, ERC20_ABI, this.provider);
      const usdce      = new ethers.Contract(USDC_E,      ERC20_ABI, this.provider);
      const [pusdBefore, usdcBefore, usdceBefore]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);

      const tx = await (adapter.redeemPositions(
        conditionId, [yesAmount, noAmount],
        { gasLimit: 400_000 },
      ) as Promise<ethers.TransactionResponse>);
      console.log(`[ctf-redeemer] NegRisk tx sent: ${tx.hash}`);
      const receipt = await tx.wait(1);

      const [pusdAfter, usdcAfter, usdceAfter]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);
      const deltaPusd  = pusdAfter  - pusdBefore;
      const deltaUsdc  = usdcAfter  - usdcBefore;
      const deltaUsdce = usdceAfter - usdceBefore;
      console.log(`[ctf-redeemer] NegRisk deltas — pUSD: ${deltaPusd} | USDC: ${deltaUsdc} | USDC.e: ${deltaUsdce}`);
      const amountUsd = Number(deltaPusd + deltaUsdc + deltaUsdce) / 1e6;

      console.log(`[ctf-redeemer] NegRisk redeemed $${amountUsd.toFixed(4)} | tx: ${tx.hash} status=${receipt?.status}`);

      if (amountUsd > 0) {
        await this.markRedeemed(positionId);
        return { redeemed: true, amountUsd, txHash: tx.hash };
      }
      // Tx succeeded but no USDC paid out — DO NOT mark redeemed; let the next
      // periodic sweep retry. Prevents silently burning tokens for $0.
      return { redeemed: false, amountUsd: 0, txHash: tx.hash, error: 'tx ok but $0 paid out' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ctf-redeemer] NegRisk redeem failed ${conditionId.slice(0, 14)}...: ${msg}`);
      return { redeemed: false, amountUsd: 0, txHash: null, error: msg };
    }
  }

  /**
   * Standard CTF path — for non-NegRisk binary markets.
   * Tries pUSD, USDC, USDC.e in sequence (the per-condition collateral varies).
   */
  private async redeemStandardCtf(params: {
    conditionId: string;
    outcome: 'YES' | 'NO';
    tokenId: string;
    positionId: string;
  }): Promise<RedeemResult> {
    const { conditionId, outcome, tokenId, positionId } = params;
    const wallet = this.wallet!;
    const walletAddr = wallet.address;

    try {
      const ctf = new ethers.Contract(CTF_FRAMEWORK, CTF_ABI, wallet);

      const balance = (await ctf.balanceOf(walletAddr, BigInt(tokenId))) as bigint;
      console.log(`[ctf-redeemer] Standard balance ${outcome} token=${tokenId.slice(0, 12)}... balance=${balance}`);

      if (balance === 0n) {
        console.log(`[ctf-redeemer] No tokens for ${conditionId.slice(0, 14)}... — marking done`);
        await this.markRedeemed(positionId);
        return { redeemed: true, amountUsd: 0, txHash: null };
      }

      const pusd       = new ethers.Contract(PUSD,        ERC20_ABI, this.provider);
      const usdcNative = new ethers.Contract(USDC_NATIVE, ERC20_ABI, this.provider);
      const usdce      = new ethers.Contract(USDC_E,      ERC20_ABI, this.provider);
      const [pusdBefore, usdcBefore, usdceBefore]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);
      console.log(`[ctf-redeemer] Balances before — pUSD: ${pusdBefore} | USDC: ${usdcBefore} | USDC.e: ${usdceBefore}`);

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

      const [pusdAfter, usdcAfter, usdceAfter]: [bigint, bigint, bigint] = await Promise.all([
        pusd.balanceOf(walletAddr)       as Promise<bigint>,
        usdcNative.balanceOf(walletAddr) as Promise<bigint>,
        usdce.balanceOf(walletAddr)      as Promise<bigint>,
      ]);
      const deltaPusd  = pusdAfter  - pusdBefore;
      const deltaUsdc  = usdcAfter  - usdcBefore;
      const deltaUsdce = usdceAfter - usdceBefore;
      console.log(`[ctf-redeemer] Deltas — pUSD: ${deltaPusd} | USDC: ${deltaUsdc} | USDC.e: ${deltaUsdce}`);
      const amountUsd = Number(deltaPusd + deltaUsdc + deltaUsdce) / 1e6;

      console.log(`[ctf-redeemer] Redeemed $${amountUsd.toFixed(4)} ${usedCollateral} | tx: ${tx.hash} status=${receipt?.status}`);

      if (amountUsd > 0) {
        await this.markRedeemed(positionId);
        return { redeemed: true, amountUsd, txHash: tx.hash };
      }
      return { redeemed: false, amountUsd: 0, txHash: tx.hash, error: 'tx ok but $0 paid out' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ctf-redeemer] Standard redeem failed ${conditionId.slice(0, 14)}...: ${msg}`);
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
