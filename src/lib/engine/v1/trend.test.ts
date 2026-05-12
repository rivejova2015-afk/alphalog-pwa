import { describe, expect, it } from "vitest";
import { tfTrendBias } from "./trend";
import type { Bar } from "@/types/backtest";

function bar(ts: string, close: number): Bar {
  return {
    ts,
    open: close - 0.05,
    high: close + 0.1,
    low: close - 0.1,
    close,
    volume: 1000,
  };
}

function uptrend(n: number, start = 100, step = 0.5): Bar[] {
  return Array.from({ length: n }, (_, i) =>
    bar(new Date(2026, 0, 1, 0, i).toISOString(), start + i * step),
  );
}

function flat(n: number, value = 100): Bar[] {
  return Array.from({ length: n }, (_, i) => bar(new Date(2026, 0, 1, 0, i).toISOString(), value));
}

describe("tfTrendBias", () => {
  it("returns 0 for too-few bars", () => {
    expect(tfTrendBias(uptrend(50))).toBe(0);
  });

  it("returns positive bias on a steady uptrend", () => {
    const bias = tfTrendBias(uptrend(250));
    expect(bias).toBeGreaterThan(0);
  });

  it("returns negative bias on a steady downtrend", () => {
    const bias = tfTrendBias(uptrend(250, 200, -0.5));
    expect(bias).toBeLessThan(0);
  });

  it("returns near-zero on flat closes (no trend direction)", () => {
    expect(tfTrendBias(flat(250))).toBeCloseTo(0, 5);
  });

  it("handles empty input gracefully", () => {
    expect(tfTrendBias([])).toBe(0);
  });
});
