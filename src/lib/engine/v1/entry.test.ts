import { describe, expect, it } from "vitest";
import { findEntry } from "./entry";
import type { Bar } from "@/types/backtest";
import type { OrderBlock } from "./structure";

function bar(o: number, h: number, l: number, c: number, idx: number): Bar {
  return { ts: new Date(2026, 0, 1, 0, idx).toISOString(), open: o, high: h, low: l, close: c, volume: 1000 };
}

function bullOB(low: number, high: number): OrderBlock {
  return { side: "bull", low, high, formedAt: "2026-01-01T00:00:00.000Z" };
}

describe("findEntry", () => {
  it("returns no_m1_bars when M1 series is empty", () => {
    const r = findEntry([], "bull", bullOB(99, 100));
    expect(r.triggered).toBe(false);
    expect(r.reason).toBe("no_m1_bars");
  });

  it("triggers a BUY when price is inside the bull OB zone", () => {
    const m1 = [bar(100, 101, 99, 99.5, 0)];   // close 99.5 inside [99,100]
    const r = findEntry(m1, "bull", bullOB(99, 100));
    expect(r.triggered).toBe(true);
    expect(r.zone).toBe("ob");
    expect(r.reason).toBe("price_in_ob");
  });

  it("does not trigger when price is away from the OB and no FVG", () => {
    const m1 = [bar(105, 106, 104, 105, 0)];   // far above [99,100]
    const r = findEntry(m1, "bull", bullOB(99, 100));
    expect(r.triggered).toBe(false);
    expect(r.reason).toBe("waiting_for_zone");
  });

  it("ignores an OB on the wrong side", () => {
    const wrongSide: OrderBlock = { side: "bear", low: 99, high: 100, formedAt: "x" };
    const m1 = [bar(100, 101, 99, 99.5, 0)];
    const r = findEntry(m1, "bull", wrongSide);
    expect(r.triggered).toBe(false);
  });

  it("triggers via an M1 bull FVG when no OB zone is hit", () => {
    // 3-bar bull FVG: bar0.high < bar2.low → gap [bar0.high, bar2.low]
    const m1 = [
      bar(100, 100.5, 99.8, 100.2, 0),  // high 100.5
      bar(101, 101.5, 100.9, 101.2, 1),
      bar(101.6, 102, 100.7, 100.7, 2), // low 100.7 > bar0.high 100.5 → bull FVG [100.5, 100.7], last close 100.7 inside
    ];
    const r = findEntry(m1, "bull", null);
    expect(r.triggered).toBe(true);
    expect(r.zone).toBe("fvg");
  });

  it("reports no_ob_no_fvg when there is neither OB nor matching FVG", () => {
    const m1 = [bar(100, 101, 99, 100, 0), bar(100, 101, 99, 100, 1)];
    const r = findEntry(m1, "bull", null);
    expect(r.triggered).toBe(false);
    expect(r.reason).toBe("no_ob_no_fvg");
  });
});
