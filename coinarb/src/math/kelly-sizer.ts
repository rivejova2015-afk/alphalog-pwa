/**
 * Classic Kelly + R:R helper.
 *
 * The phase-manager owns position sizing now (phase × capital × riskPct).
 * What's left here is the math the loop still calls:
 *   - classicKelly: optional sanity-check for confidence-derived edge
 *   - checkRiskReward: gate that the loop applies before every entry (RR_MIN)
 */

/**
 * Classic Kelly fraction.
 * @param edge Probability edge over 50/50 (e.g. 0.10 = 10%)
 * @param rewardRiskRatio Avg win / avg loss
 */
export function classicKelly(edge: number, rewardRiskRatio: number = 1.5): number {
  const p = 0.5 + edge;
  const q = 0.5 - edge;
  const b = rewardRiskRatio;
  const f = (b * p - q) / b;
  return Math.max(0, Math.min(1, f));
}

/** Validate that take-profit / stop-loss distance meets the minimum R:R. */
export function checkRiskReward(
  entryPrice: number,
  stopLoss: number,
  takeProfit: number,
  minRatio: number = 2.0,
): boolean {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  if (risk <= 0) return false;
  return reward / risk >= minRatio;
}
