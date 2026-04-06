/**
 * Pillar 4: Volatility Surface Modeling
 *
 * Models how volatility varies with distance from ATM (at-the-money)
 * and time to expiration.
 */

/**
 * ATM (at-the-money) volatility from bid-ask spread.
 */
export function atmVolatility(bid: number, ask: number): number {
  const mid = (bid + ask) / 2;
  if (mid <= 0) return 0.01;
  return ((ask - bid) / mid) * 0.5;
}

/**
 * Volatility smile: vol increases as price moves away from 0.5 (ATM).
 *
 * σ_smile(K) = σ_ATM × (1 + 2×|mid - K|)
 *
 * @param sigmaATM ATM volatility
 * @param mid Current mid price
 * @param strikePrice The price level to evaluate
 */
export function volSmile(sigmaATM: number, mid: number, strikePrice: number): number {
  const distance = Math.abs(mid - strikePrice);
  return sigmaATM * (1 + 2 * distance);
}

/**
 * Time decay (theta) — volatility per unit of sqrt(time).
 *
 * theta = (1 / √T) × σ_ATM
 *
 * @param sigmaATM ATM volatility
 * @param daysToExpiry Days until market resolution
 */
export function timeDecay(sigmaATM: number, daysToExpiry: number): number {
  if (daysToExpiry <= 0) return sigmaATM * 10; // extreme theta near expiry
  return (1 / Math.sqrt(daysToExpiry)) * sigmaATM;
}

/**
 * Convexity adjustment for fair price.
 *
 * priceAdjusted = baseFairPrice + 0.5 × σ² × T
 *
 * @param baseFairPrice Raw fair price from jump-diffusion
 * @param sigma Volatility
 * @param daysToExpiry Days to expiration
 */
export function convexityAdjustment(
  baseFairPrice: number,
  sigma: number,
  daysToExpiry: number
): number {
  const T = daysToExpiry / 365; // annualized
  const adjustment = 0.5 * sigma * sigma * T;
  return Math.max(0.001, Math.min(0.999, baseFairPrice + adjustment));
}

/**
 * Full volatility surface evaluation for a given price point.
 */
export function evaluateVolSurface(
  bid: number,
  ask: number,
  pricePoint: number,
  daysToExpiry: number
): {
  sigmaATM: number;
  sigmaSmile: number;
  theta: number;
  convexityAdj: number;
} {
  const mid = (bid + ask) / 2;
  const sigmaATM = atmVolatility(bid, ask);
  const sigmaSmile = volSmile(sigmaATM, mid, pricePoint);
  const theta = timeDecay(sigmaATM, daysToExpiry);
  const convexityAdj = 0.5 * sigmaSmile * sigmaSmile * (daysToExpiry / 365);

  return { sigmaATM, sigmaSmile, theta, convexityAdj };
}
