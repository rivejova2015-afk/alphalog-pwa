/**
 * Pillar 3: Aggressive Kelly Criterion Position Sizing
 *
 * f* = (b·p - q) / b
 *
 * With modifications:
 *   - Volatility scaling
 *   - Win streak multiplier
 *   - Dynamic leverage
 */

export interface KellyResult {
  fraction: number;       // Kelly fraction (0.10 to 0.50)
  leverage: number;       // Dynamic leverage (1.0 to 3.0)
  positionSizeUsd: number;
  stopLoss: number;       // Price level
  takeProfit: number;     // Price level
}

/**
 * Classic Kelly fraction.
 * @param edge Probability edge over 50/50 (e.g., 0.006 = 0.6%)
 * @param rewardRiskRatio Ratio of avg win / avg loss (default 1.5)
 */
function classicKelly(edge: number, rewardRiskRatio: number = 1.5): number {
  const p = 0.5 + edge;
  const q = 0.5 - edge;
  const b = rewardRiskRatio;
  return (b * p - q) / b;
}

/**
 * Volatility scaling factor.
 * Higher vol → reduce position size.
 */
function volAdjustment(volatility: number): number {
  return Math.max(0.5, 1 - volatility);
}

/**
 * Win streak multiplier for confidence building.
 */
function winStreakMultiplier(consecutiveWins: number, bonus: number = 1.5): number {
  if (consecutiveWins >= 3) return bonus;       // 50% boost
  if (consecutiveWins === 2) return 1.2;        // 20% boost
  if (consecutiveWins === 1) return 1.0;        // neutral
  return 0.8;                                    // 20% reduction
}

/**
 * Dynamic leverage based on current volatility regime.
 */
export function dynamicLeverage(volatility: number): number {
  if (volatility < 0.10) return 3.0;
  if (volatility < 0.20) return 2.0;
  if (volatility < 0.40) return 1.5;
  return 1.0;
}

/**
 * Calculate aggressive Kelly position sizing.
 *
 * @param edge Detected edge (decimal, e.g. 0.006)
 * @param volatility Current belief volatility
 * @param consecutiveWins Number of consecutive winning trades
 * @param accountValueUsd Current account value in USD
 * @param entryPrice Expected entry price
 * @param fairPrice Calculated fair price (take profit target)
 * @param maxKelly Maximum Kelly fraction (default 0.50)
 * @param maxLev Maximum leverage (default 3.0)
 * @param streakBonus Win streak bonus multiplier (default 1.5)
 */
export function aggressiveKelly(
  edge: number,
  volatility: number,
  consecutiveWins: number,
  accountValueUsd: number,
  entryPrice: number,
  fairPrice: number,
  maxKelly: number = 0.50,
  maxLev: number = 3.0,
  streakBonus: number = 1.5
): KellyResult {
  // Base Kelly
  const baseKelly = classicKelly(Math.abs(edge));

  // Apply modifications
  const volAdj = volAdjustment(volatility);
  const streakMult = winStreakMultiplier(consecutiveWins, streakBonus);

  // Aggressive Kelly with clamp
  const aggressiveFraction = baseKelly * volAdj * streakMult;
  const fraction = Math.max(0.10, Math.min(maxKelly, aggressiveFraction));

  // Dynamic leverage
  const leverage = Math.min(maxLev, dynamicLeverage(volatility));

  // Position size in USD
  const positionSizeUsd = accountValueUsd * fraction * leverage;

  // Stop loss: 2σ away from entry
  const stopLoss = entryPrice * (1 - 2 * volatility);

  // Take profit: at fair price
  const takeProfit = fairPrice;

  return {
    fraction,
    leverage,
    positionSizeUsd,
    stopLoss: Math.max(0.001, stopLoss),
    takeProfit: Math.min(0.999, takeProfit),
  };
}

/**
 * Check if risk/reward ratio meets minimum threshold.
 */
export function checkRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  minRatio: number = 1.2
): boolean {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (risk <= 0) return false;
  return (reward / risk) >= minRatio;
}
