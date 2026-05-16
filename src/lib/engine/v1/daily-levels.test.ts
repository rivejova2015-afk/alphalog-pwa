import { describe, expect, it } from "vitest";
import { previousDayLevels, detectSweep, computeDailyLevels } from "./daily-levels";
import type { Bar } from "@/types/backtest";

function bar(o: number, h: number, l: number, c: number, idx = 0): Bar {
  return { ts: new Date(2026, 0, 1, 0, idx).toISOString(), open: o, high: h, low: l, close: c, volume: 1000 };
}

describe("previousDayLevels", () => {
  it("returns null with fewer than 2 D1 bars", () => {
    expect(previousDayLevels([])).toBeNull();
    expect(previousDayLevels([bar(100, 105, 95, 102)])).toBeNull();
  });

  it("returns the second-to-last bar's high/low (yesterday)", () => {
    const d1 = [
      bar(100, 110, 90, 105, 0),   // 2 days ago
      bar(105, 120, 100, 115, 1),  // yesterday  ← PDH=120, PDL=100
      bar(115, 130, 110, 125, 2),  // today (forming)
    ];
    const r = previousDayLevels(d1);
    expect(r).toEqual({ pdh: 120, pdl: 100, ts: d1[1].ts });
  });
});

describe("detectSweep", () => {
  const pdh = 120;
  const pdl = 100;

  it("returns null when neither level is touched", () => {
    const bars = [bar(110, 115, 105, 112), bar(112, 118, 108, 115)];
    expect(detectSweep(bars, pdh, pdl)).toBeNull();
  });

  it("detects PDH sweep when a high trades above PDH", () => {
    const bars = [bar(110, 115, 105, 112), bar(115, 122, 110, 118)];
    expect(detectSweep(bars, pdh, pdl)).toBe("PDH");
  });

  it("detects PDL sweep when a low trades below PDL", () => {
    const bars = [bar(110, 115, 105, 112), bar(105, 108, 98, 102)];
    expect(detectSweep(bars, pdh, pdl)).toBe("PDL");
  });

  it("when both swept, the more recent manipulation wins", () => {
    const bars = [
      bar(115, 122, 110, 118),  // PDH swept first
      bar(110, 115, 98, 102),   // PDL swept later
    ];
    expect(detectSweep(bars, pdh, pdl)).toBe("PDL");
  });
});

describe("computeDailyLevels", () => {
  it("combines levels + sweep", () => {
    const d1 = [bar(100, 110, 90, 105, 0), bar(105, 120, 100, 115, 1), bar(115, 119, 112, 118, 2)];
    const intraday = [bar(116, 123, 114, 121)];  // high 123 > PDH 120
    const r = computeDailyLevels(d1, intraday);
    expect(r).toEqual({ pdh: 120, pdl: 100, pdhTs: d1[1].ts, swept: "PDH" });
  });

  it("returns null when D1 history is insufficient", () => {
    expect(computeDailyLevels([bar(100, 110, 90, 105)], [])).toBeNull();
  });
});
