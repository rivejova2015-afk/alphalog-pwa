import { describe, expect, it } from "vitest";
import { checkDecisionEngine } from "./decision-engine";
import { checkRangeGate } from "./range-gate";
import { checkOrderFlow } from "./order-flow";
import { checkPulseEngine } from "./pulse-engine";
import type { Bar } from "@/types/backtest";

function bar(close: number, idx = 0, open?: number, high?: number, low?: number): Bar {
  const o = open ?? close - 0.1;
  return {
    ts: new Date(2026, 0, 1, 0, idx).toISOString(),
    open: o,
    high: high ?? Math.max(o, close) + 0.05,
    low:  low  ?? Math.min(o, close) - 0.05,
    close,
    volume: 1000,
  };
}

describe("decision_engine overlay", () => {
  const off = { enabled: false, decision_score_min: 60, decision_base_start: 60 } as const;
  const on  = { enabled: true,  decision_score_min: 70, decision_base_start: 60 } as const;

  it("passes when disabled regardless of score", () => {
    expect(checkDecisionEngine(off, "BUY", 10).passed).toBe(true);
  });

  it("blocks BUY when bias_score is below base_start", () => {
    const r = checkDecisionEngine(on, "BUY", 50);
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("base_start");
  });

  it("blocks BUY when bias_score clears base_start but not score_min", () => {
    const r = checkDecisionEngine(on, "BUY", 65);
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("score_min");
  });

  it("passes BUY when bias clears both thresholds", () => {
    expect(checkDecisionEngine(on, "BUY", 75).passed).toBe(true);
  });

  it("mirrors logic for SELL (score=20 means strong SELL conviction)", () => {
    expect(checkDecisionEngine(on, "SELL", 20).passed).toBe(true);  // 100-20 = 80, passes both
    expect(checkDecisionEngine(on, "SELL", 45).passed).toBe(false); // 100-45 = 55 < base_start
  });
});

describe("range_gate overlay", () => {
  const bars = Array.from({ length: 30 }, (_, i) => bar(100 + i * 0.01, i));

  it("passes when disabled", () => {
    const cfg = { enabled: false, range_gate_mode: "RANGE_POINTS", range_gate_min_points: 5, range_gate_max_points: 10, range_gate_min_atr: 0, range_gate_max_atr: 0 } as const;
    expect(checkRangeGate(cfg, bars).passed).toBe(true);
  });

  it("blocks when range below min in POINTS mode", () => {
    const cfg = { enabled: true, range_gate_mode: "RANGE_POINTS", range_gate_min_points: 10, range_gate_max_points: 0, range_gate_min_atr: 0, range_gate_max_atr: 0 } as const;
    const r = checkRangeGate(cfg, bars);  // bars span ~0.3 → below 10
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("range_below_min");
  });

  it("passes when both bounds are 0 (unlimited)", () => {
    const cfg = { enabled: true, range_gate_mode: "RANGE_POINTS", range_gate_min_points: 0, range_gate_max_points: 0, range_gate_min_atr: 0, range_gate_max_atr: 0 } as const;
    expect(checkRangeGate(cfg, bars).passed).toBe(true);
  });

  it("returns passed when bars are too few", () => {
    const cfg = { enabled: true, range_gate_mode: "RANGE_POINTS", range_gate_min_points: 10, range_gate_max_points: 0, range_gate_min_atr: 0, range_gate_max_atr: 0 } as const;
    expect(checkRangeGate(cfg, bars.slice(0, 5)).passed).toBe(true);
  });
});

describe("order_flow overlay", () => {
  it("passes when disabled", () => {
    const cfg = { enabled: false, sweep_lookback_bars: 10, eq_tolerance_points: 0.5 } as const;
    expect(checkOrderFlow(cfg, "BUY", []).passed).toBe(true);
  });

  it("blocks when no equal-low cluster sweep", () => {
    const cfg = { enabled: true, sweep_lookback_bars: 10, eq_tolerance_points: 0.5 } as const;
    // Monotonic up — no equal lows to sweep
    const bars = Array.from({ length: 20 }, (_, i) => bar(100 + i, i));
    const r = checkOrderFlow(cfg, "BUY", bars);
    expect(r.passed).toBe(false);
  });

  it("passes BUY when last bar sweeps an equal-low cluster", () => {
    const cfg = { enabled: true, sweep_lookback_bars: 10, eq_tolerance_points: 0.2 } as const;
    // 10 bars with equal lows around 99.5, plus a sentinel, then THE sweep bar
    const bars: Bar[] = [];
    for (let i = 0; i < 10; i++) bars.push(bar(101, i, 100.8, 101.2, 99.5));
    bars.push(bar(101, 10, 100.8, 101.2, 99.6));
    // Last bar: low pierces the 99.5 cluster, close back above
    bars.push(bar(101, 11, 100, 101.5, 99.0));
    const r = checkOrderFlow(cfg, "BUY", bars);
    expect(r.passed).toBe(true);
  });

  it("HOLD short-circuits to passed", () => {
    const cfg = { enabled: true, sweep_lookback_bars: 10, eq_tolerance_points: 0.5 } as const;
    expect(checkOrderFlow(cfg, "HOLD", []).passed).toBe(true);
  });
});

describe("pulse_engine overlay", () => {
  it("passes when disabled", () => {
    const cfg = { enabled: false, pulse_window_ms: 800, min_pulse_ticks: 5, max_skew_points: 30 } as const;
    expect(checkPulseEngine(cfg, "BUY", [], []).passed).toBe(true);
  });

  it("blocks BUY when momentum bars below min", () => {
    const cfg = { enabled: true, pulse_window_ms: 5_000_000, min_pulse_ticks: 5, max_skew_points: 0 } as const;
    // Window of ~83 M1 bars at 60_000ms each
    const m1 = Array.from({ length: 90 }, (_, i) => bar(100, i, 100, 100.05, 99.95)); // flat — no momentum bars
    const r = checkPulseEngine(cfg, "BUY", m1, []);
    expect(r.passed).toBe(false);
    expect(r.reason).toContain("pulse_below_min");
  });

  it("passes BUY when momentum bars satisfy min and below max skew", () => {
    const cfg = { enabled: true, pulse_window_ms: 600_000, min_pulse_ticks: 3, max_skew_points: 50 } as const;
    // 10 M1 bars all bullish, small delta each
    const m1 = Array.from({ length: 10 }, (_, i) => bar(100 + i * 0.1, i, 100 + i * 0.1 - 0.05, 100 + i * 0.1 + 0.05, 100 + i * 0.1 - 0.1));
    const r = checkPulseEngine(cfg, "BUY", m1, []);
    expect(r.passed).toBe(true);
  });
});
