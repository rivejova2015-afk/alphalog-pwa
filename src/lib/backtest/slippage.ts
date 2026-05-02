// Slippage models. Replace "fill at exact price" with realistic execution.
// References: Almgren-Chriss (2000) market impact, VWAP-slip empirical models.

import type { Bar, Side } from "@/types/backtest";

export type SlippageMode = "fixed" | "vwap" | "time_decay" | "almgren";

export interface SlippageParams {
  mode: SlippageMode;
  fixedPoints?: number;
  participation?: number;
  pointValue?: number;
  permanentImpactCoef?: number;
  temporaryImpactCoef?: number;
}

export function computeSlippage(
  bar: Bar,
  side: Side,
  lots: number,
  params: SlippageParams,
): number {
  void side;
  switch (params.mode) {
    case "fixed":
      return params.fixedPoints ?? 0;
    case "vwap": {
      const range = bar.high - bar.low;
      const part = params.participation ?? 0.05;
      const lotsRatio = bar.volume > 0 ? Math.min(1, (lots * 100) / bar.volume) : part;
      return range * lotsRatio * 0.5;
    }
    case "time_decay": {
      const range = bar.high - bar.low;
      return range * 0.1 * Math.sqrt(Math.max(lots, 0));
    }
    case "almgren": {
      const eta   = params.temporaryImpactCoef ?? 0.05;
      const gamma = params.permanentImpactCoef ?? 0.01;
      const V = Math.max(bar.volume, 1);
      const X = lots * 100;
      const range = bar.high - bar.low;
      return ((eta * X) / V + (gamma * X) / V) * range;
    }
  }
  return 0;
}

export function applySlippage(
  rawPrice: number,
  bar: Bar,
  side: Side,
  lots: number,
  params: SlippageParams,
): number {
  const slip = computeSlippage(bar, side, lots, params);
  return side === "long" ? rawPrice + slip : rawPrice - slip;
}
