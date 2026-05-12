// Decision Engine overlay — meta-gate on the cascade bias score.
//
// Two thresholds from engine_config:
//   - decision_base_start: minimum baseline score required to even consider
//     entering. Roughly the "do we have enough conviction at all" floor.
//   - decision_score_min:  stricter score required to release the signal.
//
// When enabled, the cascade bias_score must clear both thresholds (sell side
// uses the mirror: 100 - score >= threshold). When disabled, always passes.

import type { EngineConfig } from "@/lib/validations/engine-config";
import type { SignalAction } from "../types";

type DecisionCfg = EngineConfig["overlays"]["decision_engine"];

export interface OverlayCheck {
  passed: boolean;
  reason?: string;
}

export function checkDecisionEngine(
  cfg: DecisionCfg,
  side: SignalAction,
  biasScore: number,
): OverlayCheck {
  if (!cfg.enabled) return { passed: true };
  if (side === "HOLD") return { passed: true };

  // For SELL, the score is mirrored — 30 means "70 conviction in SELL".
  const directionalScore = side === "BUY" ? biasScore : 100 - biasScore;

  if (directionalScore < cfg.decision_base_start) {
    return { passed: false, reason: `decision_base_start:${directionalScore.toFixed(1)}<${cfg.decision_base_start}` };
  }
  if (directionalScore < cfg.decision_score_min) {
    return { passed: false, reason: `decision_score_min:${directionalScore.toFixed(1)}<${cfg.decision_score_min}` };
  }
  return { passed: true };
}
