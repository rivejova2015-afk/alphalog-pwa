import { describe, expect, it } from "vitest";
import { findSwings, sessionStructure } from "./session-structure";
import type { Bar } from "@/types/backtest";

function bar(h: number, l: number, idx: number): Bar {
  const c = (h + l) / 2;
  return { ts: new Date(2026, 0, 1, idx).toISOString(), open: c, high: h, low: l, close: c, volume: 1000 };
}

// Build a bar series from explicit (high, low) pairs.
function series(pairs: [number, number][]): Bar[] {
  return pairs.map(([h, l], i) => bar(h, l, i));
}

describe("findSwings", () => {
  it("returns empty for too-few bars", () => {
    expect(findSwings(series([[10, 5], [11, 6]]))).toEqual([]);
  });

  it("detects a swing high (peak with lower bars on both sides)", () => {
    // index 3 is the peak
    const bars = series([
      [10, 8], [11, 9], [12, 10], [15, 13], [12, 10], [11, 9], [10, 8],
    ]);
    const swings = findSwings(bars);
    expect(swings.some((s) => s.kind === "high" && s.index === 3)).toBe(true);
  });

  it("detects a swing low (trough with higher bars on both sides)", () => {
    const bars = series([
      [15, 13], [14, 12], [13, 11], [12, 6], [13, 11], [14, 12], [15, 13],
    ]);
    const swings = findSwings(bars);
    expect(swings.some((s) => s.kind === "low" && s.index === 3)).toBe(true);
  });
});

describe("sessionStructure bias", () => {
  // Swing detection needs a 7-bar fractal (lookback=3). Peaks/troughs must
  // therefore sit at least 4 bars apart with strictly lower neighbours on
  // both sides.
  it("classifies HH + HL sequence as bull", () => {
    const bars = series([
      [10, 5], [11, 6], [12, 7], [13, 8],           // ramp up
      [15, 12],                                      // idx 4 → SH (15)
      [14, 11], [13, 10], [12, 9],
      [11, 7],                                       // idx 8 → SL (7)
      [13, 9], [14, 11],
      [16, 13],                                      // idx 11 → SH (16) HH
      [15, 12], [14, 11],
      [13, 9],                                       // idx 14 → SL (9)  HL
      [14, 10], [15, 11], [16, 12],
    ]);
    expect(sessionStructure(bars).bias).toBe("bull");
  });

  it("classifies LH + LL sequence as bear", () => {
    const bars = series([
      [20, 15], [19, 14], [18, 13], [17, 12],
      [16, 8],                                       // SL (8)
      [17, 9], [18, 10], [19, 11],
      [21, 14],                                      // SH (21) — wait, we need LH not HH
      [19, 12], [17, 10],
      [14, 6],                                       // SL (6) LL ✓
      [16, 9], [17, 10],
      [19, 11],                                      // SH (19) LH ✓ (19 < 21)
      [18, 10], [16, 9], [15, 8],
    ]);
    expect(sessionStructure(bars).bias).toBe("bear");
  });

  it("returns neutral when there aren't enough swings", () => {
    const s = sessionStructure(series([[10, 8], [11, 9], [10, 8]]));
    expect(s.bias).toBe("neutral");
  });

  it("nearbyLiquidity is an array (no crash on light data)", () => {
    const bars = series([
      [10, 5], [11, 6], [12, 7], [13, 8],
      [15, 12], [14, 11], [13, 10], [12, 9],
      [11, 7],
    ]);
    expect(Array.isArray(sessionStructure(bars).nearbyLiquidity)).toBe(true);
  });
});
