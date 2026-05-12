// Cascade — weighted aggregation of per-timeframe bias values into a single
// score in [0, 100], where 50 is neutral, >50 leans BUY, <50 leans SELL.
// Also exposes the raw weighted bias and the chosen side.

import type { TfState } from "./types";

export interface CascadeResult {
  score: number;            // 0..100
  side: "BUY" | "SELL" | "NONE";
  biasRaw: number;          // weighted average bias in [-100, +100]
  totalWeight: number;
}

export function combineBiasWeighted(perTf: TfState[], buyThreshold = 60, sellThreshold = 40): CascadeResult {
  if (!perTf || perTf.length === 0) {
    return { score: 50, side: "NONE", biasRaw: 0, totalWeight: 0 };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const t of perTf) {
    if (!Number.isFinite(t.bias) || !Number.isFinite(t.weight) || t.weight <= 0) continue;
    weightedSum += t.bias * t.weight;
    totalWeight += t.weight;
  }

  if (totalWeight <= 0) {
    return { score: 50, side: "NONE", biasRaw: 0, totalWeight: 0 };
  }

  const biasRaw = weightedSum / totalWeight;           // -100..+100
  const score = Math.max(0, Math.min(100, 50 + biasRaw / 2));

  let side: CascadeResult["side"] = "NONE";
  if (score >= buyThreshold) side = "BUY";
  else if (score <= sellThreshold) side = "SELL";

  return { score, side, biasRaw, totalWeight };
}
