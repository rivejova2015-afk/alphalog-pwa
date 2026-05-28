import { describe, expect, it } from "vitest";
import { lotsForPhase, phaseForEquity } from "./capital-phases";

// The cfg shape mirrors EngineConfig['modules']['capital_phases']. We construct
// minimal valid objects here to keep tests independent of validator drift.
function cfg(over: Partial<{
  enabled: boolean;
  phases: number;
  starting_capital: number;
  risk_min_pct: number;
  risk_max_pct: number;
}> = {}) {
  return {
    enabled: true,
    phases: 11,
    starting_capital: 10_000,
    risk_min_pct: 0.5,
    risk_max_pct: 2.5,
    ...over,
  };
}

describe("phaseForEquity", () => {
  it("returns 1 when disabled regardless of equity", () => {
    expect(phaseForEquity(cfg({ enabled: false }), 100_000)).toBe(1);
    expect(phaseForEquity(cfg({ enabled: false }), 0)).toBe(1);
  });

  it("returns phase 1 at starting capital (ratio = 1.0)", () => {
    expect(phaseForEquity(cfg(), 10_000)).toBe(1);
  });

  it("returns last phase at 10× starting capital", () => {
    expect(phaseForEquity(cfg({ phases: 11 }), 100_000)).toBe(11);
  });

  it("interpolates linearly between phase 1 (1×) and phase N (10×)", () => {
    // Halfway in equity ratio (5.5×) should give ~middle phase.
    const mid = phaseForEquity(cfg({ phases: 11 }), 55_000);
    expect(mid).toBeGreaterThanOrEqual(5);
    expect(mid).toBeLessThanOrEqual(7);
  });

  it("clamps to phase 1 below starting capital (drawdown)", () => {
    expect(phaseForEquity(cfg(), 5_000)).toBe(1);
    expect(phaseForEquity(cfg(), 0)).toBe(1);
  });

  it("clamps to last phase above the 10× cap", () => {
    expect(phaseForEquity(cfg({ phases: 11 }), 500_000)).toBe(11);
  });

  it("respects custom phases count", () => {
    expect(phaseForEquity(cfg({ phases: 5 }), 100_000)).toBe(5);
    expect(phaseForEquity(cfg({ phases: 5 }), 10_000)).toBe(1);
  });

  it("guards against starting_capital=0 (division by zero)", () => {
    // Should not throw or return NaN/Infinity.
    const p = phaseForEquity(cfg({ starting_capital: 0 }), 1000);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(1);
  });
});

describe("lotsForPhase", () => {
  it("returns baseLots unchanged when disabled", () => {
    expect(lotsForPhase(cfg({ enabled: false }), 100_000, 1.5)).toBe(1.5);
    expect(lotsForPhase(cfg({ enabled: false }), 1_000, 0.1)).toBe(0.1);
  });

  it("returns baseLots at phase 1 (risk_min_pct, scale = 1.0)", () => {
    // At starting capital, risk = risk_min_pct → scale = 1.
    const lots = lotsForPhase(cfg(), 10_000, 1.0);
    expect(lots).toBeCloseTo(1.0, 2);
  });

  it("scales lots proportionally to risk_pct at the last phase", () => {
    // risk_min=0.5, risk_max=2.5 → at last phase, scale = 2.5 / 0.5 = 5×.
    const lots = lotsForPhase(cfg(), 100_000, 1.0);
    expect(lots).toBeCloseTo(5.0, 2);
  });

  it("rounds to 0.01 (forex micro-lot precision)", () => {
    const lots = lotsForPhase(cfg({ phases: 11, risk_min_pct: 1, risk_max_pct: 1.333 }), 55_000, 1.0);
    // Result will be a non-trivial decimal; just verify it's rounded.
    expect(lots * 100).toBeCloseTo(Math.round(lots * 100), 5);
  });

  it("never returns below 0.01 (micro-lot minimum)", () => {
    const lots = lotsForPhase(cfg({ risk_min_pct: 10 }), 10_000, 0.0001);
    expect(lots).toBeGreaterThanOrEqual(0.01);
  });

  it("handles phases=1 edge case (no interpolation)", () => {
    // Single phase: t = 0, risk = risk_min_pct, scale = 1.
    expect(lotsForPhase(cfg({ phases: 1 }), 100_000, 2)).toBeCloseTo(2, 2);
  });

  it("guards against risk_min_pct=0 (would divide by zero in scale)", () => {
    const lots = lotsForPhase(cfg({ risk_min_pct: 0 }), 50_000, 1);
    expect(Number.isFinite(lots)).toBe(true);
    expect(lots).toBeGreaterThanOrEqual(0.01);
  });
});
