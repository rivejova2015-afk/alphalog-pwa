// Kelly criterion position sizing for futures.
//
// Formula (trading variant):
//   f* = p - (1 - p) / R
//   where:
//     p = win probability  (∈ [0,1])
//     R = avg_win / avg_loss  (loss as positive USD number)
//
// Then dollar risk at Kelly is `equity × f* × fractionalKelly`, where
// `fractionalKelly` defaults to 0.5 (half-Kelly) — industry standard for
// real-world deployment because the formula is famously fragile to estimation
// error in p and R.
//
// Contracts come out as `floor(dollarRisk / riskPerContract)` where
// `riskPerContract = slTicks × tickValueUSD`. Always clamped to [min, max].
//
// Pure function — no I/O, no DB calls. Caller passes equity + stats, gets
// a contract count + the fraction back for logging.

export interface KellyInputs {
  /** Account equity in USD. */
  equityUSD: number;
  /** Win probability in [0, 1]. */
  winRate: number;
  /** Avg win in USD (positive). */
  avgWinUSD: number;
  /** Avg loss in USD (positive — magnitude, not signed). */
  avgLossUSD: number;
  /** Stop loss distance in ticks. */
  slTicks: number;
  /** USD value of a single tick for this contract. */
  tickValueUSD: number;
  /** Fractional Kelly multiplier — default 0.5 (half-Kelly). */
  fractionalKelly?: number;
  /** Min contracts to trade when f* > 0 — default 1. */
  minContracts?: number;
  /** Max contracts cap — default 10. */
  maxContracts?: number;
}

export type KellyMethod =
  | "kelly"
  | "skipped_negative_edge"
  | "skipped_invalid_inputs"
  | "clamped_min"
  | "clamped_max";

export interface KellyResult {
  /** Recommended contracts (always ≥0). 0 means do not trade. */
  contracts: number;
  /** Raw Kelly fraction (pre-fractional, pre-clamp). Useful for telemetry. */
  rawFraction: number;
  /** Applied fraction = rawFraction × fractionalKelly. */
  appliedFraction: number;
  /** Dollar risk implied by the applied fraction. */
  dollarRiskUSD: number;
  /** USD risk per single contract = slTicks × tickValueUSD. */
  riskPerContractUSD: number;
  /** What method actually decided the size — for log explainability. */
  method: KellyMethod;
}

function isPositiveFinite(x: number): boolean {
  return Number.isFinite(x) && x > 0;
}

export function computeKellyContracts(input: KellyInputs): KellyResult {
  const {
    equityUSD,
    winRate,
    avgWinUSD,
    avgLossUSD,
    slTicks,
    tickValueUSD,
    fractionalKelly = 0.5,
    minContracts = 1,
    maxContracts = 10,
  } = input;

  const riskPerContractUSD = slTicks * tickValueUSD;

  // Reject obviously broken inputs — return 0 contracts so the caller can
  // fall back to the manual default. Caller sees `method` to know why.
  if (
    !isPositiveFinite(equityUSD) ||
    !isPositiveFinite(avgWinUSD) ||
    !isPositiveFinite(avgLossUSD) ||
    !isPositiveFinite(slTicks) ||
    !isPositiveFinite(tickValueUSD) ||
    !Number.isFinite(winRate) || winRate < 0 || winRate > 1
  ) {
    return {
      contracts:          0,
      rawFraction:        0,
      appliedFraction:    0,
      dollarRiskUSD:      0,
      riskPerContractUSD,
      method:             "skipped_invalid_inputs",
    };
  }

  // Kelly fraction. R = avg_win / avg_loss.
  const R = avgWinUSD / avgLossUSD;
  const rawFraction = winRate - (1 - winRate) / R;

  if (rawFraction <= 0) {
    return {
      contracts:          0,
      rawFraction,
      appliedFraction:    0,
      dollarRiskUSD:      0,
      riskPerContractUSD,
      method:             "skipped_negative_edge",
    };
  }

  // Apply fractional Kelly safety multiplier.
  const safeFraction = Math.max(0, Math.min(1, fractionalKelly));
  const appliedFraction = rawFraction * safeFraction;
  const dollarRiskUSD = equityUSD * appliedFraction;

  const rawContracts = Math.floor(dollarRiskUSD / riskPerContractUSD);
  const safeMin = Math.max(0, Math.floor(minContracts));
  const safeMax = Math.max(safeMin, Math.floor(maxContracts));

  let contracts = rawContracts;
  let method: KellyMethod = "kelly";

  if (contracts < safeMin) {
    contracts = safeMin;
    method = "clamped_min";
  } else if (contracts > safeMax) {
    contracts = safeMax;
    method = "clamped_max";
  }

  return {
    contracts,
    rawFraction,
    appliedFraction,
    dollarRiskUSD,
    riskPerContractUSD,
    method,
  };
}
