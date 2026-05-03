/**
 * C2 — Asymmetric Kelly by Strike
 *
 * Binary markets have a true reward/risk ratio that depends on the entry price:
 *   YES @ 0.10 → b = (1-0.10)/0.10 = 9.0  (high upside, small downside)
 *   YES @ 0.90 → b = (1-0.90)/0.90 = 0.11 (tiny upside, large downside)
 *
 * The classic aggressiveKelly() uses a fixed b=1.5 which is wrong for binary markets.
 * This function computes the real Kelly fraction using the actual binary payout ratio.
 */

export interface AsymmetricKellyResult {
  fraction: number;          // optimal Kelly fraction (0 to maxFraction)
  positionSizeUsd: number;   // fraction × accountValue
  rewardRiskRatio: number;   // b = (1 - entryPrice) / entryPrice
  winProb: number;           // estimated win probability
  kellyRaw: number;          // raw Kelly fraction before cap
}

/**
 * Compute Kelly fraction using the true binary-market reward/risk ratio.
 *
 * @param edge           Edge = (fairPrice - marketPrice) / marketPrice
 * @param entryPrice     Market price of the outcome (0-1), e.g. 0.45 for YES @ 45¢
 * @param maxFraction    Hard cap on fraction (0.10 = 10%)
 * @param accountValue   Total account balance in USD
 */
export function asymmetricKelly(
  edge: number,
  entryPrice: number,
  maxFraction: number,
  accountValue: number,
): AsymmetricKellyResult {
  // Clamp entry price to avoid division by zero
  const p = Math.max(0.01, Math.min(0.99, entryPrice));

  // b = payout ratio: how many dollars won per dollar risked
  const b = (1 - p) / p;

  // Estimated win probability from edge
  // edge = (fairPrice - marketPrice) / marketPrice → fairPrice ≈ marketPrice × (1 + edge)
  // winProb bounded to [0.01, 0.99]
  const winProb = Math.max(0.01, Math.min(0.99, 0.5 + Math.abs(edge)));
  const lossProb = 1 - winProb;

  // Kelly formula: f* = (b·p - q) / b
  const kellyRaw = (b * winProb - lossProb) / b;

  // Cap at maxFraction and floor at 0
  const fraction = Math.max(0, Math.min(maxFraction, kellyRaw));
  const positionSizeUsd = fraction * accountValue;

  return { fraction, positionSizeUsd, rewardRiskRatio: b, winProb, kellyRaw };
}
