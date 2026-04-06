/**
 * Pillar 5: Stochastic Volatility (Heston Model)
 *
 * SDE system:
 *   dP_t = μ·P_t·dt + √v_t·P_t·dW¹_t
 *   dv_t = κ(θ - v_t)dt + σ_v·√v_t·dW²_t
 *
 * Used for dynamic leverage adjustment based on evolving volatility.
 */

export interface HestonParams {
  kappa: number;       // Mean reversion speed (0.1 to 1.0)
  theta: number;       // Long-term variance (e.g., 0.15)
  sigmaV: number;      // Vol of vol (e.g., 0.3)
  rho: number;         // Correlation between price and vol (e.g., -0.3)
}

export interface HestonState {
  variance: number;    // Current instantaneous variance v_t
  leverage: number;    // Recommended leverage based on vol regime
}

const DEFAULT_CRYPTO_PARAMS: HestonParams = {
  kappa: 0.5,
  theta: 0.15,
  sigmaV: 0.3,
  rho: -0.3,
};

/**
 * Evolve variance one step using Euler-Maruyama discretization.
 *
 * v_{t+dt} = v_t + κ(θ - v_t)·dt + σ_v·√v_t·dW
 *
 * @param currentVariance Current v_t
 * @param dt Time step (fraction of a day, e.g. 250ms / 86_400_000)
 * @param randomNormal Standard normal variate Z ~ N(0,1)
 * @param params Heston model parameters
 */
export function evolveVariance(
  currentVariance: number,
  dt: number,
  randomNormal: number,
  params: HestonParams = DEFAULT_CRYPTO_PARAMS
): number {
  const v = Math.max(0.0001, currentVariance); // floor to avoid sqrt(negative)

  const meanReversion = params.kappa * (params.theta - v) * dt;
  const volShock = params.sigmaV * Math.sqrt(v) * Math.sqrt(dt) * randomNormal;

  const newVariance = v + meanReversion + volShock;

  // Floor at 0.01 (1% annualized vol minimum)
  return Math.max(0.01, newVariance);
}

/**
 * Determine leverage based on current Heston variance regime.
 */
export function hestonLeverage(variance: number, maxLeverage: number = 3.0): number {
  if (variance < 0.08) return Math.min(maxLeverage, 3.0);
  if (variance < 0.15) return Math.min(maxLeverage, 2.0);
  if (variance < 0.30) return Math.min(maxLeverage, 1.5);
  return 1.0;
}

/**
 * Simple Box-Muller transform for generating normal variates.
 * Generates a pair of independent standard normal random variables.
 */
export function boxMuller(): [number, number] {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
  return [z0, z1];
}

/**
 * Full Heston step: evolve variance and return updated state with leverage.
 */
export function hestonStep(
  currentVariance: number,
  dt: number,
  params: HestonParams = DEFAULT_CRYPTO_PARAMS,
  maxLeverage: number = 3.0
): HestonState {
  const [z] = boxMuller();
  const variance = evolveVariance(currentVariance, dt, z, params);
  const leverage = hestonLeverage(variance, maxLeverage);

  return { variance, leverage };
}
