/**
 * Pillar 2: Momentum Physics (Derivatives of Price)
 *
 * Maps price movement to physical analogues:
 *   Position  = ∫P dt
 *   Velocity  = dP/dt       (1st derivative)
 *   Acceleration = d²P/dt²  (2nd derivative)
 *   Jerk      = d³P/dt³     (3rd derivative — reversal predictor)
 */

export interface MomentumVector {
  velocity: number;       // dP/dt
  acceleration: number;   // d²P/dt²
  jerk: number;           // d³P/dt³
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;     // 0-1
}

/**
 * Calculate velocity (1st derivative) using finite differences.
 * @param prices Price history (newest last)
 * @param dt Time step in seconds between samples
 */
function calcVelocity(prices: number[], dt: number): number {
  if (prices.length < 2) return 0;
  const n = prices.length;
  return (prices[n - 1] - prices[n - 2]) / dt;
}

/**
 * Calculate acceleration (2nd derivative) using central differences.
 * a = (P_t - 2·P_{t-1} + P_{t-2}) / Δt²
 */
function calcAcceleration(prices: number[], dt: number): number {
  if (prices.length < 3) return 0;
  const n = prices.length;
  return (prices[n - 1] - 2 * prices[n - 2] + prices[n - 3]) / (dt * dt);
}

/**
 * Calculate jerk (3rd derivative).
 * j = (P_t - 3·P_{t-1} + 3·P_{t-2} - P_{t-3}) / Δt³
 */
function calcJerk(prices: number[], dt: number): number {
  if (prices.length < 4) return 0;
  const n = prices.length;
  return (
    prices[n - 1] - 3 * prices[n - 2] + 3 * prices[n - 3] - prices[n - 4]
  ) / (dt * dt * dt);
}

/**
 * Compute the full momentum vector from price history.
 *
 * @param priceHistory Array of prices (newest last), sampled at uniform intervals
 * @param dtSeconds Time between samples in seconds (default 0.25 = 250ms)
 * @param accThreshold Minimum acceleration for signal (default 0.00005)
 * @param jerkThreshold Jerk reversal threshold (default -0.0001)
 */
export function calculateMomentumVector(
  priceHistory: number[],
  dtSeconds: number = 0.25,
  accThreshold: number = 0.00005,
  jerkThreshold: number = -0.0001
): MomentumVector {
  const velocity = calcVelocity(priceHistory, dtSeconds);
  const acceleration = calcAcceleration(priceHistory, dtSeconds);
  const jerk = calcJerk(priceHistory, dtSeconds);

  let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 0;

  // BUY: acceleration positive AND jerk not reversing
  if (acceleration > accThreshold && jerk >= jerkThreshold) {
    signal = 'BUY';
    confidence = Math.min(1.0, Math.abs(acceleration) / 0.0001);
  }
  // SELL: acceleration negative AND jerk confirming
  else if (acceleration < -accThreshold && jerk <= -jerkThreshold) {
    signal = 'SELL';
    confidence = Math.min(1.0, Math.abs(acceleration) / 0.0001);
  }

  return { velocity, acceleration, jerk, signal, confidence };
}

/**
 * Check if jerk indicates imminent reversal.
 * Strong negative jerk = momentum collapsing = likely reversal.
 */
export function isReversalImminent(jerk: number, threshold: number = -0.0001): boolean {
  return jerk < threshold;
}
