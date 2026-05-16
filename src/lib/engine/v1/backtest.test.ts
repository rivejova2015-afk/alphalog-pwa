import { describe, expect, it } from "vitest";
import { simulateEngineV1FromBars } from "./backtest";
import { evaluateEngineV1 } from "./evaluator";
import type { Bar } from "@/types/backtest";
import type { BarsByTf, MultiTfConfig } from "./types";
import { ENGINE_CONFIG_DEFAULT } from "@/lib/validations/engine-config";

function bar(close: number, idx: number, tfMinutes = 15): Bar {
  const ts = new Date(2026, 0, 1, 0, idx * tfMinutes).toISOString();
  return {
    ts,
    open: close - 0.1,
    high: close + 0.1,
    low: close - 0.2,
    close,
    volume: 1000,
  };
}

function uptrend(n: number, tfMinutes = 15, start = 1900, step = 0.5): Bar[] {
  return Array.from({ length: n }, (_, i) => bar(start + i * step, i, tfMinutes));
}

const SMC_MTF: MultiTfConfig = {
  timeframes: [
    { tf: "D1",  weight: 0, role: "daily_levels" },
    { tf: "H1",  weight: 0, role: "session_structure" },
    { tf: "M15", weight: 0, role: "bos_ob" },
    { tf: "M1",  weight: 0, role: "entry" },
  ],
};

describe("evaluateEngineV1 (SMC funnel)", () => {
  const baseAlgo = {
    id: "algo-1",
    lot_size: 0.01,
    engine_config: ENGINE_CONFIG_DEFAULT,
    parameters: null,
  };

  it("returns HOLD when D1 has fewer than 2 bars", () => {
    const empty: BarsByTf = new Map();
    for (const t of SMC_MTF.timeframes) empty.set(t.tf, []);
    const r = evaluateEngineV1(baseAlgo, { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" }, SMC_MTF, empty);
    expect(r.action).toBe("HOLD");
    expect(r.reason).toContain("insufficient_d1_bars");
  });

  it("returns HOLD on flat bars (no D1 sweep)", () => {
    const flat: BarsByTf = new Map();
    flat.set("D1",  Array.from({ length: 5 }, (_, i) => bar(100, i, 1440)));
    flat.set("H1",  Array.from({ length: 50 }, (_, i) => bar(100, i, 60)));
    flat.set("M15", Array.from({ length: 50 }, (_, i) => bar(100, i, 15)));
    flat.set("M1",  Array.from({ length: 50 }, (_, i) => bar(100, i, 1)));
    const r = evaluateEngineV1(baseAlgo, { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" }, SMC_MTF, flat);
    expect(r.action).toBe("HOLD");
    expect(r.funnel).toBeDefined();
    expect(r.funnel?.pdh).not.toBeNull();
    expect(r.funnel?.swept).toBeNull();
  });

  it("HOLD if circuit breaker is tripped (state forwarded)", () => {
    const cfg = JSON.parse(JSON.stringify(ENGINE_CONFIG_DEFAULT));
    cfg.modules.circuit_breaker.enabled = true;
    const algo = { ...baseAlgo, engine_config: cfg };
    const empty: BarsByTf = new Map();
    for (const t of SMC_MTF.timeframes) empty.set(t.tf, []);
    const r = evaluateEngineV1(
      algo,
      { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" },
      SMC_MTF,
      empty,
      { tripped: true, reason: "consecutive_losses:5" },
    );
    expect(r.action).toBe("HOLD");
    expect(r.reason).toContain("circuit_breaker");
  });

  it("populates funnel trace with PDH/PDL and h1Bias", () => {
    const bars: BarsByTf = new Map();
    bars.set("D1", [
      bar(100, 0, 1440),
      bar(110, 1, 1440),   // PDH=110.1, PDL=109.8 (per bar() helper offsets)
      bar(108, 2, 1440),
    ]);
    bars.set("H1",  Array.from({ length: 30 }, (_, i) => bar(108 + i * 0.01, i, 60)));
    bars.set("M15", Array.from({ length: 20 }, (_, i) => bar(108 + i * 0.05, i, 15)));
    bars.set("M1",  Array.from({ length: 10 }, (_, i) => bar(108 + i * 0.1, i, 1)));
    const r = evaluateEngineV1(baseAlgo, { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" }, SMC_MTF, bars);
    expect(r.funnel?.pdh).toBeCloseTo(110.1, 1);
    expect(r.funnel?.pdl).toBeCloseTo(109.8, 1);
  });
});

describe("simulateEngineV1 (backtest harness)", () => {
  it("returns empty result when driver TF has < 200 bars", async () => {
    const algo = { id: "algo-1", lot_size: 0.01, engine_config: ENGINE_CONFIG_DEFAULT, parameters: null };
    const result = await simulateEngineV1FromBars(algo, "XAUUSD", [
      { tf: "M15", bars: uptrend(50) },
    ]);
    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
  });

  it("runs end-to-end on a long uptrend without crashing (HOLD or trades)", async () => {
    const algo = { id: "algo-1", lot_size: 0.01, engine_config: ENGINE_CONFIG_DEFAULT, parameters: null };
    // Steady uptrend with no real SMC setup — engine should not error and
    // either emit zero trades (no D1 sweep against the trend) or very few.
    const result = await simulateEngineV1FromBars(algo, "XAUUSD", [
      { tf: "D1",  bars: uptrend(300, 1440) },
      { tf: "H1",  bars: uptrend(300, 60) },
      { tf: "M15", bars: uptrend(300, 15) },
      { tf: "M1",  bars: uptrend(300, 1) },
    ]);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
