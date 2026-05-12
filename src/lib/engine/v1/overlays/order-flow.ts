// Order Flow overlay — requires a recent liquidity sweep in the direction of
// the trade. SMC concept: price often takes out a cluster of equal highs (or
// lows) and then reverses — that "sweep" is institutional liquidity being
// hit. We only release the signal when:
//
//   - BUY:  a recent bar swept a cluster of equal LOWS (low broke them,
//           close back inside the cluster).
//   - SELL: a recent bar swept a cluster of equal HIGHS.
//
// `sweep_lookback_bars` defines the cluster horizon; `eq_tolerance_points`
// defines how close two highs/lows must be to count as "equal".

import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Bar } from "@/types/backtest";
import type { SignalAction } from "../types";
import type { OverlayCheck } from "./decision-engine";

type FlowCfg = EngineConfig["overlays"]["order_flow"];

function findEqualLevels(values: number[], tolerance: number): number[] {
  // Returns "anchor" prices where at least 2 bars cluster within tolerance.
  const sorted = [...values].sort((a, b) => a - b);
  const anchors: number[] = [];
  let cluster: number[] = [];

  for (const v of sorted) {
    if (cluster.length === 0 || Math.abs(v - cluster[0]) <= tolerance) {
      cluster.push(v);
    } else {
      if (cluster.length >= 2) {
        const mean = cluster.reduce((s, x) => s + x, 0) / cluster.length;
        anchors.push(mean);
      }
      cluster = [v];
    }
  }
  if (cluster.length >= 2) {
    anchors.push(cluster.reduce((s, x) => s + x, 0) / cluster.length);
  }
  return anchors;
}

export function checkOrderFlow(
  cfg: FlowCfg,
  side: SignalAction,
  bars: Bar[],
): OverlayCheck {
  if (!cfg.enabled) return { passed: true };
  if (side === "HOLD") return { passed: true };

  const lookback = Math.max(3, cfg.sweep_lookback_bars);
  if (!bars || bars.length < lookback + 2) {
    return { passed: false, reason: `not_enough_bars:${bars?.length ?? 0}<${lookback + 2}` };
  }

  const tolerance = cfg.eq_tolerance_points;
  const recent = bars.slice(-lookback - 1, -1);
  const last = bars[bars.length - 1];

  if (side === "BUY") {
    const eqLows = findEqualLevels(recent.map((b) => b.low), tolerance);
    // Sweep: the last bar's low pierced an eq-low cluster but closed above it.
    const swept = eqLows.some((lvl) => last.low < lvl - tolerance * 0.1 && last.close > lvl);
    if (!swept) return { passed: false, reason: "no_low_sweep" };
    return { passed: true };
  }

  if (side === "SELL") {
    const eqHighs = findEqualLevels(recent.map((b) => b.high), tolerance);
    const swept = eqHighs.some((lvl) => last.high > lvl + tolerance * 0.1 && last.close < lvl);
    if (!swept) return { passed: false, reason: "no_high_sweep" };
    return { passed: true };
  }

  return { passed: true };
}
