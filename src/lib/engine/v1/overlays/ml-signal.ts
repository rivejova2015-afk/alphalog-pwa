// ML overlay — applies a trained logistic-regression model (from ml_models)
// as an extra gate after the cascade decides a side.
//
// Semantics:
//   - When no model is provided (model = null) → passed (true). Caller skips
//     loading the row when the algorithm doesn't have one yet, so this acts
//     as a graceful no-op and doesn't surprise users who never trained.
//   - BUY: requires predicted_probability >= min_probability (default 0.55).
//   - SELL: requires (1 - predicted_probability) >= min_probability — the
//     classifier was trained on "profitable LONG", so we mirror it.

import type { Bar } from "@/types/backtest";
import type { SignalAction } from "../types";
import type { OverlayCheck } from "./decision-engine";
import { extractFeatures, predict, type MlModel } from "@/lib/backtest/ml-signal";

export interface MlOverlayConfig {
  enabled: boolean;
  min_probability: number;  // 0..1
}

export function checkMlSignal(
  cfg: MlOverlayConfig,
  side: SignalAction,
  bars: Bar[],
  model: MlModel | null,
): OverlayCheck {
  if (!cfg.enabled) return { passed: true };
  if (side === "HOLD") return { passed: true };
  if (!model) return { passed: true, reason: "no_model_trained" };
  if (!bars || bars.length === 0) return { passed: true, reason: "no_bars" };

  const features = extractFeatures(bars);
  const last = features[features.length - 1];
  if (!last) return { passed: true, reason: "no_features" };

  const pLong = predict(model, last);
  const directional = side === "BUY" ? pLong : 1 - pLong;

  if (directional < cfg.min_probability) {
    return { passed: false, reason: `ml_below_threshold:${directional.toFixed(3)}<${cfg.min_probability}` };
  }
  return { passed: true };
}
