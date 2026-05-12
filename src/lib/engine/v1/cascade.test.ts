import { describe, expect, it } from "vitest";
import { combineBiasWeighted } from "./cascade";
import type { TfState } from "./types";

function tf(name: string, weight: number, bias: number): TfState {
  return { tf: name, weight, role: "test", bias, bars: 300 };
}

describe("cascade combineBiasWeighted", () => {
  it("returns neutral for empty input", () => {
    const r = combineBiasWeighted([]);
    expect(r.score).toBe(50);
    expect(r.side).toBe("NONE");
  });

  it("returns BUY when all TFs strongly bullish", () => {
    const r = combineBiasWeighted([
      tf("D1", 0.4, 80),
      tf("H4", 0.3, 70),
      tf("H1", 0.3, 60),
    ]);
    expect(r.score).toBeGreaterThan(60);
    expect(r.side).toBe("BUY");
    expect(r.biasRaw).toBeGreaterThan(0);
  });

  it("returns SELL when all TFs strongly bearish", () => {
    const r = combineBiasWeighted([
      tf("D1", 0.4, -80),
      tf("H4", 0.3, -70),
      tf("H1", 0.3, -60),
    ]);
    expect(r.score).toBeLessThan(40);
    expect(r.side).toBe("SELL");
    expect(r.biasRaw).toBeLessThan(0);
  });

  it("returns NONE when TFs cancel out", () => {
    const r = combineBiasWeighted([
      tf("D1", 0.5, 50),
      tf("H4", 0.5, -50),
    ]);
    expect(r.side).toBe("NONE");
    expect(r.score).toBeCloseTo(50, 0);
  });

  it("ignores TFs with zero weight", () => {
    const r = combineBiasWeighted([
      tf("D1", 0, 100),
      tf("H1", 1, -100),
    ]);
    expect(r.side).toBe("SELL");
  });

  it("ignores NaN bias", () => {
    const r = combineBiasWeighted([
      tf("D1", 0.5, NaN),
      tf("H4", 0.5, 80),
    ]);
    expect(r.side).toBe("BUY");
  });
});
