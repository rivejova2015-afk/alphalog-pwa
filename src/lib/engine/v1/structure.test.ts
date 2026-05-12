import { describe, expect, it } from "vitest";
import { findFvgs, findOrderBlocks, structureBias } from "./structure";
import type { Bar } from "@/types/backtest";

function bar(close: number, open?: number, high?: number, low?: number, idx = 0): Bar {
  const o = open ?? close - 0.5;
  return {
    ts: new Date(2026, 0, 1, 0, idx).toISOString(),
    open: o,
    high: high ?? Math.max(o, close) + 0.1,
    low: low ?? Math.min(o, close) - 0.1,
    close,
    volume: 1000,
  };
}

describe("structure: order blocks", () => {
  it("returns empty on insufficient bars", () => {
    expect(findOrderBlocks([])).toEqual([]);
    expect(findOrderBlocks([bar(100), bar(101)])).toEqual([]);
  });

  it("detects a bull OB before a bullish impulse", () => {
    // 20 calm bars + 1 bearish + 1 strong bull impulse
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) bars.push(bar(100 + i * 0.05, 100 + i * 0.05 - 0.1, undefined, undefined, i));
    bars.push(bar(99.5, 100.2, 100.3, 99.4, 20));            // bearish prep
    bars.push(bar(103, 99.5, 103.5, 99.4, 21));              // strong bull impulse
    const obs = findOrderBlocks(bars);
    expect(obs.length).toBeGreaterThan(0);
    expect(obs.some((o) => o.side === "bull")).toBe(true);
  });

  it("marks an OB as mitigated when price reclaims through it", () => {
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) bars.push(bar(100 + i * 0.05, undefined, undefined, undefined, i));
    bars.push(bar(99.5, 100.2, 100.3, 99.4, 20));
    bars.push(bar(103, 99.5, 103.5, 99.4, 21));
    // Later bars trade below the bull OB low (99.4)
    for (let i = 22; i < 30; i++) bars.push(bar(99, 99.5, 99.8, 98.5, i));
    const obs = findOrderBlocks(bars);
    const bullObs = obs.filter((o) => o.side === "bull");
    expect(bullObs.some((o) => o.mitigatedAt !== undefined)).toBe(true);
  });
});

describe("structure: FVGs", () => {
  it("detects a bullish FVG (gap up)", () => {
    const bars: Bar[] = [
      bar(100, 100, 100.5, 99.8, 0),
      bar(101, 100, 101.5, 99.9, 1),
      bar(103, 102, 103.5, 101.0, 2), // low(102) > high of bar[0] (100.5) ⇒ bull FVG
    ];
    const fvgs = findFvgs(bars);
    expect(fvgs).toHaveLength(1);
    expect(fvgs[0].side).toBe("bull");
  });

  it("detects a bearish FVG (gap down)", () => {
    const bars: Bar[] = [
      bar(103, 103, 103.5, 102.5, 0),
      bar(101, 102, 102.2, 100.8, 1),
      bar(99, 100, 100.0, 98.5, 2),   // high(100) < low of bar[0] (102.5) ⇒ bear FVG
    ];
    const fvgs = findFvgs(bars);
    expect(fvgs).toHaveLength(1);
    expect(fvgs[0].side).toBe("bear");
  });
});

describe("structure: bias", () => {
  it("returns neutral when no structure near price", () => {
    const bars: Bar[] = Array.from({ length: 30 }, (_, i) => bar(100 + i * 0.01, undefined, undefined, undefined, i));
    const r = structureBias(bars);
    expect(r.bias).toBe(0);
  });

  it("clamps the cumulative bias to [-30, +30]", () => {
    // Force many active bull OBs near current price.
    const bars: Bar[] = [];
    for (let i = 0; i < 50; i++) {
      bars.push(bar(100, 100.5, 100.6, 99.4, i * 2));
      bars.push(bar(103, 100, 103.5, 99.5, i * 2 + 1));
    }
    const r = structureBias(bars);
    expect(r.bias).toBeGreaterThanOrEqual(-30);
    expect(r.bias).toBeLessThanOrEqual(30);
  });
});
