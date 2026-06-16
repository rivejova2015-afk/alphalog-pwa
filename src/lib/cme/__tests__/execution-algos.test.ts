import { describe, it, expect } from "vitest";
import { planTwap, planVwap, planIs } from "../execution-algos";

const START = new Date("2026-06-15T14:00:00Z");

describe("planTwap", () => {
  it("divide 10 contracts en 5 slices de 2 (uniformes)", () => {
    const r = planTwap({ totalQuantity: 10, durationMinutes: 20, sliceCount: 5, startAt: START });
    expect(r.algo).toBe("twap");
    expect(r.totalSlices).toBe(5);
    expect(r.slices.map((s) => s.quantity)).toEqual([2, 2, 2, 2, 2]);
  });

  it("distribuye remainder: 11 contracts en 5 slices → [3,2,2,2,2]", () => {
    const r = planTwap({ totalQuantity: 11, durationMinutes: 20, sliceCount: 5, startAt: START });
    expect(r.slices.map((s) => s.quantity)).toEqual([3, 2, 2, 2, 2]);
    expect(r.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(11);
  });

  it("12 contracts en 5 slices → [3,3,2,2,2]", () => {
    const r = planTwap({ totalQuantity: 12, durationMinutes: 20, sliceCount: 5, startAt: START });
    expect(r.slices.map((s) => s.quantity)).toEqual([3, 3, 2, 2, 2]);
  });

  it("intervalos temporales uniformes: 20min en 5 slices = 5min cada uno", () => {
    const r = planTwap({ totalQuantity: 5, durationMinutes: 20, sliceCount: 5, startAt: START });
    const intervals: number[] = [];
    for (let i = 1; i < r.slices.length; i++) {
      intervals.push(
        new Date(r.slices[i].scheduledAt).getTime() - new Date(r.slices[i - 1].scheduledAt).getTime(),
      );
    }
    // 4 intervalos de 5 min = 300000ms
    expect(intervals).toEqual([300_000, 300_000, 300_000, 300_000]);
  });

  it("primera slice scheduledAt = startAt", () => {
    const r = planTwap({ totalQuantity: 5, durationMinutes: 10, sliceCount: 5, startAt: START });
    expect(r.slices[0].scheduledAt).toBe(START.toISOString());
  });

  it("clampea sliceCount al máximo de totalQuantity (no slices vacías)", () => {
    const r = planTwap({ totalQuantity: 3, durationMinutes: 10, sliceCount: 10, startAt: START });
    expect(r.totalSlices).toBe(3); // no 10
    expect(r.slices.every((s) => s.quantity >= 1)).toBe(true);
  });

  it("inputs inválidos throw", () => {
    expect(() => planTwap({ totalQuantity: 0, durationMinutes: 10, sliceCount: 5 })).toThrow();
    expect(() => planTwap({ totalQuantity: 10, durationMinutes: 10, sliceCount: 0 })).toThrow();
    expect(() => planTwap({ totalQuantity: 10, durationMinutes: -1, sliceCount: 5 })).toThrow();
  });
});

describe("planVwap", () => {
  it("distribuye proporcional al volume profile", () => {
    // Perfil: open + close pesados (U-shape típica equity futures)
    const profile = [4, 1, 1, 1, 3]; // sum=10
    const r = planVwap({
      totalQuantity: 10,
      durationMinutes: 20,
      sliceCount: 5,
      volumeProfile: profile,
      startAt: START,
    });
    expect(r.algo).toBe("vwap");
    expect(r.slices.map((s) => s.quantity)).toEqual([4, 1, 1, 1, 3]);
  });

  it("fallback a TWAP si volumeProfile no matchea sliceCount", () => {
    const r = planVwap({
      totalQuantity: 10,
      durationMinutes: 20,
      sliceCount: 5,
      volumeProfile: [1, 1, 1], // 3 ≠ 5 → fallback TWAP
      startAt: START,
    });
    expect(r.algo).toBe("vwap"); // mantiene label
    expect(r.slices.map((s) => s.quantity)).toEqual([2, 2, 2, 2, 2]);
  });

  it("normaliza y redondea preservando totalQuantity exacto", () => {
    const profile = [1, 1, 1]; // todos iguales
    const r = planVwap({
      totalQuantity: 7,
      durationMinutes: 10,
      sliceCount: 3,
      volumeProfile: profile,
      startAt: START,
    });
    expect(r.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(7);
  });

  it("skip slices con quantity=0 después de rounding", () => {
    // Perfil muy desbalanceado: la última slice queda con qty=0 después de round
    const profile = [100, 1];
    const r = planVwap({
      totalQuantity: 5,
      durationMinutes: 10,
      sliceCount: 2,
      volumeProfile: profile,
      startAt: START,
    });
    // 5 * (100/101) = 4.95 → 4 + remainder=1 → primera slice=5, segunda=0
    expect(r.slices.every((s) => s.quantity > 0)).toBe(true);
  });
});

describe("planIs (Implementation Shortfall)", () => {
  it("urgency=0 equivale a TWAP (slices uniformes)", () => {
    const r = planIs({
      totalQuantity: 10,
      durationMinutes: 20,
      sliceCount: 5,
      urgency: 0,
      startAt: START,
    });
    expect(r.slices.map((s) => s.quantity)).toEqual([2, 2, 2, 2, 2]);
  });

  it("urgency=1 concentra la ejecución al inicio", () => {
    const r = planIs({
      totalQuantity: 10,
      durationMinutes: 20,
      sliceCount: 5,
      urgency: 1,
      startAt: START,
    });
    // Primera slice debe ser >= que la última.
    const qtys = r.slices.map((s) => s.quantity);
    expect(qtys[0]).toBeGreaterThanOrEqual(qtys[qtys.length - 1]);
    // Suma debe ser exacta.
    expect(qtys.reduce((s, q) => s + q, 0)).toBe(10);
  });

  it("urgency intermedio (0.5) distribuye con decay moderado", () => {
    const r = planIs({
      totalQuantity: 20,
      durationMinutes: 30,
      sliceCount: 10,
      urgency: 0.5,
      startAt: START,
    });
    expect(r.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(20);
    // Primera mitad de slices debe acumular más que la segunda mitad.
    const firstHalf = r.slices.slice(0, 5).reduce((s, sl) => s + sl.quantity, 0);
    const secondHalf = r.slices.slice(5).reduce((s, sl) => s + sl.quantity, 0);
    expect(firstHalf).toBeGreaterThan(secondHalf);
  });

  it("clampea urgency fuera de [0,1]", () => {
    const r1 = planIs({ totalQuantity: 5, durationMinutes: 10, sliceCount: 5, urgency: -0.5, startAt: START });
    const r2 = planIs({ totalQuantity: 5, durationMinutes: 10, sliceCount: 5, urgency: 2, startAt: START });
    expect(r1.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(5);
    expect(r2.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(5);
  });

  it("default urgency=0.5 cuando no se pasa", () => {
    const r = planIs({ totalQuantity: 10, durationMinutes: 20, sliceCount: 5, startAt: START });
    expect(r.slices.reduce((s, sl) => s + sl.quantity, 0)).toBe(10);
    expect(r.slices[0].quantity).toBeGreaterThan(r.slices[r.slices.length - 1].quantity);
  });
});
