import { describe, expect, it } from "vitest";
import { detectBOS } from "./bos";
import type { Bar } from "@/types/backtest";

function bar(o: number, h: number, l: number, c: number, idx: number): Bar {
  return { ts: new Date(2026, 0, 1, 0, idx).toISOString(), open: o, high: h, low: l, close: c, volume: 1000 };
}

describe("detectBOS", () => {
  it("returns null direction on insufficient bars", () => {
    expect(detectBOS([]).direction).toBeNull();
    expect(detectBOS([bar(10, 11, 9, 10, 0)]).direction).toBeNull();
  });

  it("detects a bull BOS — close above the prior swing high", () => {
    // swing high forms around idx 4 (peak ~15), then later a bar closes above it
    const bars: Bar[] = [
      bar(10, 11, 9, 10, 0),
      bar(10, 12, 10, 11, 1),
      bar(11, 13, 10, 12, 2),
      bar(12, 14, 11, 13, 3),
      bar(13, 15, 12, 14, 4),   // swing high candidate (peak 15)
      bar(14, 14, 12, 13, 5),
      bar(13, 13, 11, 12, 6),
      bar(12, 13, 11, 12, 7),
      bar(12, 14, 11, 13, 8),
      bar(13, 16, 12, 16, 9),   // closes 16 > prior swing high 15 → bull BOS
    ];
    const r = detectBOS(bars);
    expect(r.direction).toBe("bull");
    expect(r.brokenSwingPrice).toBe(15);
  });

  it("detects a bear BOS — close below the prior swing low", () => {
    const bars: Bar[] = [
      bar(20, 21, 19, 20, 0),
      bar(20, 20, 18, 19, 1),
      bar(19, 19, 17, 18, 2),
      bar(18, 18, 16, 17, 3),
      bar(17, 17, 15, 16, 4),   // swing low candidate (trough 15)
      bar(16, 18, 16, 17, 5),
      bar(17, 19, 17, 18, 6),
      bar(18, 19, 17, 18, 7),
      bar(18, 19, 16, 17, 8),
      bar(17, 18, 13, 14, 9),   // closes 14 < prior swing low 15 → bear BOS
    ];
    const r = detectBOS(bars);
    expect(r.direction).toBe("bear");
    expect(r.brokenSwingPrice).toBe(15);
  });

  it("returns null when price stays inside structure (no break)", () => {
    const bars: Bar[] = [
      bar(10, 11, 9, 10, 0),
      bar(10, 12, 10, 11, 1),
      bar(11, 13, 10, 12, 2),
      bar(12, 14, 11, 13, 3),
      bar(13, 15, 12, 14, 4),
      bar(14, 14, 12, 13, 5),
      bar(13, 13, 11, 12, 6),
      bar(12, 13, 11, 12, 7),
      bar(12, 13, 11, 12, 8),
      bar(12, 13, 11, 12, 9),   // never closes above 15 or below the low
    ];
    expect(detectBOS(bars).direction).toBeNull();
  });
});
