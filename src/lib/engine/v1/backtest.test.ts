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

describe("evaluateEngineV1 (pure)", () => {
  const baseAlgo = {
    id: "algo-1",
    lot_size: 0.01,
    engine_config: ENGINE_CONFIG_DEFAULT,
    parameters: null,
  };

  const mtfDefault: MultiTfConfig = {
    timeframes: [
      { tf: "D1",  weight: 0.30, role: "trend" },
      { tf: "H4",  weight: 0.25, role: "structure" },
      { tf: "H1",  weight: 0.20, role: "session" },
      { tf: "M15", weight: 0.15, role: "ob" },
      { tf: "M5",  weight: 0.07, role: "impulse" },
      { tf: "M1",  weight: 0.03, role: "exec" },
    ],
  };

  it("returns HOLD when all TF bars are empty", () => {
    const empty: BarsByTf = new Map();
    for (const t of mtfDefault.timeframes) empty.set(t.tf, []);
    const r = evaluateEngineV1(baseAlgo, { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" }, mtfDefault, empty);
    expect(r.action).toBe("HOLD");
  });

  it("emits a HOLD when the cascade score falls below threshold", () => {
    const flat: BarsByTf = new Map();
    flat.set("D1",  Array.from({ length: 220 }, (_, i) => bar(100, i, 1440)));
    flat.set("H4",  Array.from({ length: 220 }, (_, i) => bar(100, i, 240)));
    flat.set("H1",  Array.from({ length: 220 }, (_, i) => bar(100, i, 60)));
    flat.set("M15", Array.from({ length: 220 }, (_, i) => bar(100, i, 15)));
    flat.set("M5",  Array.from({ length: 220 }, (_, i) => bar(100, i, 5)));
    flat.set("M1",  Array.from({ length: 220 }, (_, i) => bar(100, i, 1)));
    const r = evaluateEngineV1(baseAlgo, { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" }, mtfDefault, flat);
    expect(r.action).toBe("HOLD");
    expect(r.bias_score).toBeDefined();
  });

  it("HOLD if circuit breaker is tripped (state forwarded)", () => {
    const cfg = JSON.parse(JSON.stringify(ENGINE_CONFIG_DEFAULT));
    cfg.modules.circuit_breaker.enabled = true;
    const algo = { ...baseAlgo, engine_config: cfg };
    const empty: BarsByTf = new Map();
    for (const t of mtfDefault.timeframes) empty.set(t.tf, []);
    const r = evaluateEngineV1(
      algo,
      { now: new Date("2026-01-01T10:00:00Z"), symbol: "XAUUSD" },
      mtfDefault,
      empty,
      { tripped: true, reason: "consecutive_losses:5" },
    );
    expect(r.action).toBe("HOLD");
    expect(r.reason).toContain("circuit_breaker");
  });
});

describe("simulateEngineV1 (backtest)", () => {
  it("returns empty result when driver TF has < 200 bars", async () => {
    const algo = {
      id: "algo-1", lot_size: 0.01, engine_config: ENGINE_CONFIG_DEFAULT, parameters: null,
    };
    const result = await simulateEngineV1FromBars(algo, "XAUUSD", [
      { tf: "M15", bars: uptrend(50) },
    ]);
    expect(result.trades).toHaveLength(0);
    expect(result.equityCurve).toHaveLength(0);
  });

  it("produces a non-empty equity curve over a long uptrend with seeded bars", async () => {
    const algo = {
      id: "algo-1",
      lot_size: 0.01,
      engine_config: ENGINE_CONFIG_DEFAULT,
      parameters: null,
    };

    // Seed enough M15 bars so all higher TFs (computed in evaluateEngineV1 from
    // M15 alone) reach the 200-bar minimum for EMA-200.
    const m15 = uptrend(300, 15);
    const m1  = uptrend(300, 1);
    const m5  = uptrend(300, 5);
    const h1  = uptrend(300, 60);
    const h4  = uptrend(300, 240);
    const d1  = uptrend(300, 1440);

    const result = await simulateEngineV1FromBars(algo, "XAUUSD", [
      { tf: "D1", bars: d1 },
      { tf: "H4", bars: h4 },
      { tf: "H1", bars: h1 },
      { tf: "M15", bars: m15 },
      { tf: "M5", bars: m5 },
      { tf: "M1", bars: m1 },
    ]);

    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
