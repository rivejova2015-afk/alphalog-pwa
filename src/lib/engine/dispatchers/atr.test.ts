import { describe, expect, it } from "vitest";
import { computeAtrFromBars } from "./atr";
import type { Bar } from "@/types/backtest";

function bar(o: number, h: number, l: number, c: number, ts = "2026-01-01T00:00:00Z"): Bar {
  return { ts, open: o, high: h, low: l, close: c, volume: 0, spread: null };
}

describe("computeAtrFromBars", () => {
  it("returns null when bars.length <= period (cannot seed)", () => {
    // First bar has no prev close → TR series length = bars.length - 1.
    // ATR(14) needs >= 14 TRs, so bars.length must be >= 15.
    const ten = Array.from({ length: 10 }, (_, i) => bar(100, 102, 98, 100 + i));
    expect(computeAtrFromBars(ten, 14)).toBeNull();
    const fourteen = Array.from({ length: 14 }, (_, i) => bar(100, 102, 98, 100 + i));
    expect(computeAtrFromBars(fourteen, 14)).toBeNull();
  });

  it("succeeds at exactly period+1 bars (minimum seed)", () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => bar(100, 102, 98, 100 + i));
    expect(computeAtrFromBars(fifteen, 14)).not.toBeNull();
  });

  it("computes Wilder ATR(14) on a flat synthetic series", () => {
    // 20 bars with high-low = 2.0 constant. ATR should converge to ~2.0.
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) bars.push(bar(100, 102, 100, 101));
    const atr = computeAtrFromBars(bars, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(1.9);
    expect(atr!).toBeLessThan(2.1);
  });

  it("ATR scales with bar range — wider bars give higher ATR", () => {
    const tight: Bar[] = Array.from({ length: 30 }, () => bar(100, 101, 99, 100));
    const wide:  Bar[] = Array.from({ length: 30 }, () => bar(100, 110, 90, 100));
    const a = computeAtrFromBars(tight, 14);
    const b = computeAtrFromBars(wide, 14);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!).toBeGreaterThan(a! * 5);  // ~10x wider range → ~10x ATR
  });

  it("Wilder smoothing converges (later values dominate over time)", () => {
    // First 15 bars range 1.0, next 15 bars range 5.0. ATR after smoothing
    // should be between the two, biased toward the recent regime.
    const bars: Bar[] = [];
    for (let i = 0; i < 15; i++) bars.push(bar(100, 100.5, 99.5, 100));
    for (let i = 0; i < 15; i++) bars.push(bar(100, 102.5, 97.5, 100));
    const atr = computeAtrFromBars(bars, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(1.0);   // moved up from initial 1.0
    expect(atr!).toBeLessThan(5.0);      // not yet at full 5.0
  });

  it("incorporates gap moves via |high - prevClose| and |low - prevClose|", () => {
    // Bars with internal range 1.0 but big gap-up between them — TR should
    // pick up the gap, not just the intrabar range.
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i * 10;  // each bar 10 points higher than the last
      bars.push(bar(base, base + 0.5, base - 0.5, base));
    }
    const atr = computeAtrFromBars(bars, 14);
    expect(atr).not.toBeNull();
    // TR for each bar = max(1.0, |high_i - prev_close|=10.5, |low_i - prev_close|=9.5) = 10.5
    // ATR should converge to ~10.5, dominated by the gap component.
    expect(atr!).toBeGreaterThan(9);
    expect(atr!).toBeLessThan(12);
  });

  it("returns null when period is invalid", () => {
    const bars: Bar[] = Array.from({ length: 30 }, () => bar(100, 101, 99, 100));
    expect(computeAtrFromBars(bars, 0)).toBeNull();
    expect(computeAtrFromBars(bars, -5)).toBeNull();
    expect(computeAtrFromBars(bars, NaN)).toBeNull();
  });

  it("returns null on empty or non-array input", () => {
    expect(computeAtrFromBars([] as Bar[], 14)).toBeNull();
  });

  it("returns null when a TR computation produces non-finite values", () => {
    // Corrupted bar with NaN
    const bars: Bar[] = Array.from({ length: 20 }, () => bar(100, 101, 99, 100));
    bars[10] = bar(NaN, NaN, NaN, NaN);
    expect(computeAtrFromBars(bars, 14)).toBeNull();
  });

  it("uses smaller period when configured", () => {
    const bars: Bar[] = Array.from({ length: 20 }, () => bar(100, 103, 97, 100));
    const atr5  = computeAtrFromBars(bars, 5);
    const atr14 = computeAtrFromBars(bars, 14);
    expect(atr5).not.toBeNull();
    expect(atr14).not.toBeNull();
    // On a flat-range series both converge to ~6.0
    expect(atr5!).toBeCloseTo(6, 1);
    expect(atr14!).toBeCloseTo(6, 1);
  });
});
