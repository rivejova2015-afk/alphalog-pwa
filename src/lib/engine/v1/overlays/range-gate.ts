// Range Gate overlay — blocks entries when the market is too tight (chop) or
// too wide (volatility spike). Two equivalent modes:
//
//   RANGE_POINTS: gate by the absolute price range (high - low) of the last
//                 N bars in "points" (price units, e.g. 0.5 = 5 pips on EURUSD).
//   RANGE_ATR:    gate by the latest ATR(14) value, also in price units.
//
// In both modes: range/atr must fall within [min, max] for the signal to pass.
// A zero on either bound means "no limit on that side". When both bounds are
// 0, the gate effectively allows everything (overlay still reports passed).

import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Bar } from "@/types/backtest";
import { atr } from "@/lib/backtest/indicators";
import type { OverlayCheck } from "./decision-engine";

type RangeCfg = EngineConfig["overlays"]["range_gate"];

const RANGE_LOOKBACK = 20;

export function checkRangeGate(cfg: RangeCfg, bars: Bar[]): OverlayCheck {
  if (!cfg.enabled) return { passed: true };
  if (!bars || bars.length < 15) return { passed: true };

  if (cfg.range_gate_mode === "RANGE_POINTS") {
    const slice = bars.slice(-RANGE_LOOKBACK);
    let hi = -Infinity;
    let lo = Infinity;
    for (const b of slice) {
      if (b.high > hi) hi = b.high;
      if (b.low  < lo) lo = b.low;
    }
    const range = hi - lo;
    if (!Number.isFinite(range)) return { passed: true };

    if (cfg.range_gate_min_points > 0 && range < cfg.range_gate_min_points) {
      return { passed: false, reason: `range_below_min:${range.toFixed(4)}<${cfg.range_gate_min_points}` };
    }
    if (cfg.range_gate_max_points > 0 && range > cfg.range_gate_max_points) {
      return { passed: false, reason: `range_above_max:${range.toFixed(4)}>${cfg.range_gate_max_points}` };
    }
    return { passed: true };
  }

  // RANGE_ATR
  const atrSeries = atr(bars, 14);
  const atrLast = atrSeries[atrSeries.length - 1];
  if (!Number.isFinite(atrLast) || atrLast <= 0) return { passed: true };

  if (cfg.range_gate_min_atr > 0 && atrLast < cfg.range_gate_min_atr) {
    return { passed: false, reason: `atr_below_min:${atrLast.toFixed(4)}<${cfg.range_gate_min_atr}` };
  }
  if (cfg.range_gate_max_atr > 0 && atrLast > cfg.range_gate_max_atr) {
    return { passed: false, reason: `atr_above_max:${atrLast.toFixed(4)}>${cfg.range_gate_max_atr}` };
  }
  return { passed: true };
}
