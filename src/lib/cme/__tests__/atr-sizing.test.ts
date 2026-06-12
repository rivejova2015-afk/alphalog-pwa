import { describe, it, expect, vi } from "vitest";
import { tickSizeForContract, computeAtrSlTpTicks } from "../atr-sizing";

describe("tickSizeForContract", () => {
  it("ES tick = 0.25", () => expect(tickSizeForContract("ESH4")).toBe(0.25));
  it("MES tick = 0.25", () => expect(tickSizeForContract("MESH4")).toBe(0.25));
  it("NQ tick = 0.25", () => expect(tickSizeForContract("NQH4")).toBe(0.25));
  it("YM tick = 1.0", () => expect(tickSizeForContract("YMH4")).toBe(1.0));
  it("GC tick = 0.1", () => expect(tickSizeForContract("GCJ4")).toBe(0.1));
  it("CL tick = 0.01", () => expect(tickSizeForContract("CLH4")).toBe(0.01));
  it("contrato desconocido → 0.01 (conservador)", () => expect(tickSizeForContract("ZZZH4")).toBe(0.01));
});

function makeBars(closes: number[]) {
  return closes.map((c, i) => ({
    ts: new Date(2026, 0, 1, 9, i * 15).toISOString(),
    open: c - 0.5,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 100,
  }));
}

function makeSvcWith(bars: ReturnType<typeof makeBars> | null) {
  // Simulamos la cadena .from().select().eq().eq().order().limit() → { data: ... }
  const orderLimit = vi.fn().mockResolvedValue({ data: bars });
  const orderChain = { order: vi.fn(() => ({ limit: orderLimit })) };
  const eqChain2 = { eq: vi.fn(() => orderChain) };
  const eqChain1 = { eq: vi.fn(() => eqChain2) };
  const selectChain = { select: vi.fn(() => eqChain1) };
  const from = vi.fn(() => selectChain);
  // returns descending order — el helper invierte; simulamos con orden descendente
  orderLimit.mockResolvedValue({ data: bars ? [...bars].reverse() : null });
  return { from } as unknown as Parameters<typeof computeAtrSlTpTicks>[0];
}

describe("computeAtrSlTpTicks", () => {
  it("sin multipliers → source='no_multipliers'", async () => {
    const svc = makeSvcWith([]);
    const r = await computeAtrSlTpTicks(svc, "ESH4", {});
    expect(r.source).toBe("no_multipliers");
    expect(r.slTicks).toBeNull();
    expect(r.tpTicks).toBeNull();
  });

  it("con multipliers pero sin bars → source='no_bars'", async () => {
    const svc = makeSvcWith([]);
    const r = await computeAtrSlTpTicks(svc, "ESH4", { atr_sl_multiplier: 1.5, atr_tp_multiplier: 3 });
    expect(r.source).toBe("no_bars");
    expect(r.slTicks).toBeNull();
  });

  it("con suficientes bars: computa slTicks/tpTicks proporcionales al ATR", async () => {
    const bars = makeBars([4500, 4501, 4502, 4503, 4504, 4505, 4506, 4507, 4508, 4509, 4510, 4511, 4512, 4513, 4514, 4515]);
    const svc = makeSvcWith(bars);
    const r = await computeAtrSlTpTicks(svc, "ESH4", {
      atr_sl_multiplier: 1.5,
      atr_tp_multiplier: 3,
      atr_period: 14,
      atr_timeframe: "M15",
    });
    expect(r.source).toBe("atr");
    expect(r.atrPoints).toBeGreaterThan(0);
    expect(r.slTicks).toBeGreaterThanOrEqual(1);
    expect(r.tpTicks).toBeGreaterThanOrEqual(1);
    // tpTicks debe ser ~2× slTicks (ratio 3/1.5)
    expect(r.tpTicks).toBeGreaterThan(r.slTicks!);
  });

  it("solo SL multiplier configurado → tpTicks=null", async () => {
    const bars = makeBars(Array.from({ length: 16 }, (_, i) => 4500 + i));
    const svc = makeSvcWith(bars);
    const r = await computeAtrSlTpTicks(svc, "ESH4", { atr_sl_multiplier: 2 });
    expect(r.slTicks).toBeGreaterThan(0);
    expect(r.tpTicks).toBeNull();
  });
});
