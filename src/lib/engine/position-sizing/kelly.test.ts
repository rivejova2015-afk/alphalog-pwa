import { describe, it, expect } from "vitest";
import { computeKellyContracts } from "./kelly";

const baseInputs = {
  equityUSD:    50_000,
  winRate:      0.55,
  avgWinUSD:    300,
  avgLossUSD:   200,
  slTicks:      20,
  tickValueUSD: 12.5,      // ES default
  fractionalKelly: 0.5,
  minContracts: 1,
  maxContracts: 10,
};

describe("computeKellyContracts", () => {
  it("returns 0 contracts when win rate yields negative edge", () => {
    const r = computeKellyContracts({ ...baseInputs, winRate: 0.30 });
    expect(r.contracts).toBe(0);
    expect(r.method).toBe("skipped_negative_edge");
    expect(r.rawFraction).toBeLessThan(0);
  });

  it("returns 0 contracts when inputs are invalid (zero equity)", () => {
    const r = computeKellyContracts({ ...baseInputs, equityUSD: 0 });
    expect(r.contracts).toBe(0);
    expect(r.method).toBe("skipped_invalid_inputs");
  });

  it("returns 0 contracts when win rate is out of [0,1]", () => {
    const r = computeKellyContracts({ ...baseInputs, winRate: 1.5 });
    expect(r.contracts).toBe(0);
    expect(r.method).toBe("skipped_invalid_inputs");
  });

  it("computes a positive size on a profitable strategy", () => {
    const r = computeKellyContracts(baseInputs);
    // f* = 0.55 - 0.45 / 1.5 = 0.55 - 0.30 = 0.25
    // applied = 0.25 × 0.5 = 0.125
    // dollarRisk = 50_000 × 0.125 = 6_250
    // riskPerContract = 20 × 12.5 = 250
    // contracts = floor(6250 / 250) = 25 → clamped to max 10
    expect(r.rawFraction).toBeCloseTo(0.25, 4);
    expect(r.appliedFraction).toBeCloseTo(0.125, 4);
    expect(r.dollarRiskUSD).toBeCloseTo(6_250, 2);
    expect(r.riskPerContractUSD).toBeCloseTo(250, 2);
    expect(r.contracts).toBe(10);
    expect(r.method).toBe("clamped_max");
  });

  it("clamps to min when raw floor is 0 but edge is positive", () => {
    // Tiny equity → contracts < 1 → clamps up to 1.
    const r = computeKellyContracts({ ...baseInputs, equityUSD: 1_000 });
    // dollarRisk = 1000 × 0.125 = 125, /250 = 0.5 → floor 0 → clamp min 1
    expect(r.contracts).toBe(1);
    expect(r.method).toBe("clamped_min");
  });

  it("honors minContracts=0 by leaving sub-1 floors at 0", () => {
    const r = computeKellyContracts({ ...baseInputs, equityUSD: 1_000, minContracts: 0 });
    expect(r.contracts).toBe(0);
    expect(r.method).toBe("kelly");
  });

  it("respects custom maxContracts cap", () => {
    const r = computeKellyContracts({ ...baseInputs, maxContracts: 3 });
    expect(r.contracts).toBe(3);
    expect(r.method).toBe("clamped_max");
  });

  it("scales linearly with equity within bounds", () => {
    // Choose equities that divide riskPerContract evenly so floor() doesn't
    // introduce rounding noise across the comparison.
    // dollarRisk = equity × 0.125, /250 = equity / 2000
    const small = computeKellyContracts({ ...baseInputs, equityUSD: 4_000, maxContracts: 100 });
    const big   = computeKellyContracts({ ...baseInputs, equityUSD: 40_000, maxContracts: 100 });
    expect(small.contracts).toBe(2);
    expect(big.contracts).toBe(20);
  });

  it("uses half-Kelly by default", () => {
    const r = computeKellyContracts(baseInputs);
    expect(r.appliedFraction).toBeCloseTo(r.rawFraction * 0.5, 4);
  });

  it("clamps fractionalKelly to [0,1]", () => {
    const r = computeKellyContracts({ ...baseInputs, fractionalKelly: 5.0, maxContracts: 100 });
    // Should behave as fractionalKelly=1 (full Kelly).
    // dollarRisk = 50_000 × 0.25 = 12_500, /250 = 50
    expect(r.contracts).toBe(50);
  });
});
