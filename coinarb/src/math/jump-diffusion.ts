/**
 * Pillar 1: Logit Jump-Diffusion Pricing Model
 *
 * Calculates fair value of conditional tokens using SDE:
 *   dP_t = μ(P_t)dt + σ(P_t)dW_t + dJ_t
 *
 * Bounded to (0,1) for probability markets.
 */

export interface JumpDiffusionParams {
  jumpIntensity: number;     // λ — events/hour (default 0.1)
  jumpMeanSize: number;      // μ_jump (default 0.05)
  jumpVolatility: number;    // σ_jump (default 0.02)
}

const DEFAULT_PARAMS: JumpDiffusionParams = {
  jumpIntensity: 0.1,
  jumpMeanSize: 0.05,
  jumpVolatility: 0.02,
};

/**
 * Estimate belief volatility from realized vol + spread vol.
 */
export function estimateBeliefVolatility(
  priceHistory: number[],
  bid: number,
  ask: number
): number {
  // Realized volatility from log returns (last 20 points)
  const window = priceHistory.slice(-20);
  let sumSqReturns = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i - 1] <= 0 || window[i] <= 0) continue;
    const logReturn = Math.log(window[i] / window[i - 1]);
    sumSqReturns += logReturn * logReturn;
  }
  const sigmaRealized = window.length > 1
    ? Math.sqrt(sumSqReturns / (window.length - 1))
    : 0.01;

  // Spread-based volatility
  const mid = (bid + ask) / 2;
  const sigmaSpread = mid > 0 ? ((ask - bid) / mid) * 0.5 : 0.01;

  // Weighted blend: 70% realized, 30% spread
  return 0.7 * sigmaRealized + 0.3 * sigmaSpread;
}

/**
 * Compute drift correction (risk-neutral measure).
 */
function driftCorrection(
  p: number,
  sigma: number,
  params: JumpDiffusionParams
): number {
  // Jensen's inequality convexity: -σ²/2 · P · (1-P)
  const convexity = -(sigma * sigma / 2) * p * (1 - p);
  // Jump compensation: -λ · E[jump_size]
  const jumpComp = -params.jumpIntensity * params.jumpMeanSize;
  return convexity + jumpComp;
}

/**
 * Compute fair price using jump-diffusion model.
 *
 * @param marketPrice Current traded probability (0-1)
 * @param sigma Belief volatility
 * @param dt Time increment in hours (default 250ms = 0.0000694h)
 * @param params Jump process parameters
 * @returns Fair price bounded (0.001, 0.999)
 */
export function computeFairPrice(
  marketPrice: number,
  sigma: number,
  dt: number = 250 / 3_600_000, // 250ms in hours
  params: JumpDiffusionParams = DEFAULT_PARAMS
): number {
  const p = Math.max(0.001, Math.min(0.999, marketPrice));

  // Drift adjustment
  const drift = driftCorrection(p, sigma, params) * dt;

  // Volatility convexity premium
  const volConvexity = 0.5 * sigma * sigma * dt;

  // Jump premium: λ · E[jump²] · dt  (variance of jump component)
  const jumpPremium = params.jumpIntensity *
    (params.jumpMeanSize * params.jumpMeanSize + params.jumpVolatility * params.jumpVolatility) *
    dt;

  const fairPrice = p + drift + volConvexity + jumpPremium;

  return Math.max(0.001, Math.min(0.999, fairPrice));
}

/**
 * Compute edge: signed difference between fair and market.
 * Positive = market underpriced (buy opportunity).
 * Negative = market overpriced (sell opportunity).
 */
export function computeEdge(fairPrice: number, marketPrice: number): number {
  if (marketPrice <= 0) return 0;
  return (fairPrice - marketPrice) / marketPrice;
}
