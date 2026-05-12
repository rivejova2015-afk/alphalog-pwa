// Pulse Engine overlay — requires a recent momentum burst in the direction of
// the trade. Originally designed for latency-arb tick streams; in the
// polling-based engine we approximate it from M1/M5 bar momentum:
//
//   - `pulse_window_ms` is the time horizon we look at (default 800ms ≈ 0
//     bars on M5; we treat it as "last N bars" with N derived from the bar
//     period). For polling-based use we lower-bound at the last 1 M1 bar
//     or last 1 M5 bar, whichever is available.
//   - `min_pulse_ticks` becomes "minimum momentum bars" — count of bars in
//     the window where close moved in the trade direction.
//   - `max_skew_points` caps how much directional move qualifies; protects
//     against runaway spikes (anti-stop-hunt).

import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Bar } from "@/types/backtest";
import type { SignalAction } from "../types";
import type { OverlayCheck } from "./decision-engine";

type PulseCfg = EngineConfig["overlays"]["pulse_engine"];

// Map window in ms to a bar count on the given TF.
function barsInWindow(tf: string, windowMs: number): number {
  const tfMs: Record<string, number> = {
    M1:  60_000,
    M5:  300_000,
    M15: 900_000,
    H1:  3_600_000,
  };
  const per = tfMs[tf] ?? 300_000;
  return Math.max(1, Math.ceil(windowMs / per));
}

export function checkPulseEngine(
  cfg: PulseCfg,
  side: SignalAction,
  m1Bars: Bar[],
  m5Bars: Bar[],
): OverlayCheck {
  if (!cfg.enabled) return { passed: true };
  if (side === "HOLD") return { passed: true };

  // Prefer M1 if available; fall back to M5.
  const tf = m1Bars.length >= 5 ? "M1" : "M5";
  const bars = tf === "M1" ? m1Bars : m5Bars;
  if (!bars || bars.length < 2) {
    return { passed: false, reason: "no_pulse_bars" };
  }

  const want = Math.max(1, Math.min(bars.length - 1, barsInWindow(tf, cfg.pulse_window_ms)));
  const slice = bars.slice(-want);

  let momentumBars = 0;
  let totalMove = 0;
  for (const b of slice) {
    const delta = b.close - b.open;
    if (side === "BUY" && delta > 0) { momentumBars++; totalMove += delta; }
    if (side === "SELL" && delta < 0) { momentumBars++; totalMove += -delta; }
  }

  if (momentumBars < cfg.min_pulse_ticks) {
    return { passed: false, reason: `pulse_below_min:${momentumBars}<${cfg.min_pulse_ticks}` };
  }
  if (cfg.max_skew_points > 0 && totalMove > cfg.max_skew_points) {
    return { passed: false, reason: `pulse_above_skew:${totalMove.toFixed(2)}>${cfg.max_skew_points}` };
  }
  return { passed: true };
}
