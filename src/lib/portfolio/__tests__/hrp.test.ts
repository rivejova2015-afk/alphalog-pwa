import { describe, it, expect } from "vitest";
import { pearson, correlationMatrix, correlationDistance, stdVector } from "../correlation";
import { hrpAllocate } from "../hrp";

describe("pearson correlation", () => {
  it("series idénticas → correlación 1", () => {
    expect(pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeCloseTo(1, 5);
  });

  it("series anti-correlacionadas → -1", () => {
    expect(pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 5);
  });

  it("series random sin correlación → cerca de 0", () => {
    const a = [1, -1, 1, -1, 1, -1];
    const b = [1, 1, -1, -1, 1, 1];
    const c = pearson(a, b);
    expect(Math.abs(c)).toBeLessThan(0.5);
  });

  it("series demasiado cortas → 0", () => {
    expect(pearson([1], [2])).toBe(0);
  });

  it("series constantes → 0 (varianza cero)", () => {
    expect(pearson([1, 1, 1, 1], [2, 3, 4, 5])).toBe(0);
  });
});

describe("correlationMatrix", () => {
  it("matriz cuadrada KxK con diagonal=1", () => {
    const series = [
      [1, 2, 3, 4],
      [4, 3, 2, 1],
      [1, 1, 2, 2],
    ];
    const m = correlationMatrix(series);
    expect(m.length).toBe(3);
    expect(m[0][0]).toBe(1);
    expect(m[1][1]).toBe(1);
    expect(m[2][2]).toBe(1);
    expect(m[0][1]).toBeCloseTo(-1, 5);
    expect(m[1][0]).toBeCloseTo(-1, 5);
  });
});

describe("correlationDistance", () => {
  it("d(i,i) = 0 (perfectly correlated con sí mismo)", () => {
    const corr = [[1, 0], [0, 1]];
    const d = correlationDistance(corr);
    expect(d[0][0]).toBe(0);
    expect(d[1][1]).toBe(0);
  });

  it("d(perfect anti-corr) = 1", () => {
    const corr = [[1, -1], [-1, 1]];
    const d = correlationDistance(corr);
    expect(d[0][1]).toBeCloseTo(1, 5);
  });
});

describe("hrpAllocate", () => {
  it("1 sola estrategia → weight=1", () => {
    const r = hrpAllocate({ series: [[1, 2, 3]], labels: ["A"] });
    expect(r).toEqual([{ label: "A", weight: 1 }]);
  });

  it("sin estrategias → []", () => {
    expect(hrpAllocate({ series: [] })).toEqual([]);
  });

  it("pesos suman 1 con K estrategias", () => {
    const series = [
      [0.01, 0.02, -0.01, 0.015, 0.005, -0.005, 0.01],
      [-0.005, 0.01, 0.02, -0.01, 0.005, 0.015, -0.01],
      [0.02, -0.01, 0.005, 0.01, -0.005, 0.02, 0.015],
    ];
    const r = hrpAllocate({ series });
    const sum = r.reduce((s, a) => s + a.weight, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("estrategias menos volátiles reciben más peso (inverse variance)", () => {
    // Serie A: muy poco volátil. Serie B: muy volátil.
    const lowVol = [0.001, 0.002, 0.001, 0.002, 0.001, 0.002, 0.001];
    const highVol = [0.05, -0.05, 0.04, -0.04, 0.06, -0.06, 0.05];
    const r = hrpAllocate({ series: [lowVol, highVol], labels: ["low", "high"] });
    const lowWeight = r.find((x) => x.label === "low")!.weight;
    const highWeight = r.find((x) => x.label === "high")!.weight;
    expect(lowWeight).toBeGreaterThan(highWeight);
  });

  it("labels respetadas en el output", () => {
    const r = hrpAllocate({
      series: [[1, 2, 3, 4], [4, 3, 2, 1]],
      labels: ["alpha", "beta"],
    });
    expect(r.map((a) => a.label).sort()).toEqual(["alpha", "beta"]);
  });

  it("estrategias idénticas → pesos iguales (50/50)", () => {
    const sameSeries = [0.01, 0.02, -0.01, 0.005, 0.015];
    const r = hrpAllocate({
      series: [sameSeries, sameSeries],
      labels: ["A", "B"],
    });
    expect(r[0].weight).toBeCloseTo(0.5, 5);
    expect(r[1].weight).toBeCloseTo(0.5, 5);
  });
});

describe("stdVector", () => {
  it("computa stdev de cada serie", () => {
    const v = stdVector([
      [1, 2, 3, 4, 5],
      [10, 10, 10, 10, 10], // constante → std=0
    ]);
    expect(v[0]).toBeCloseTo(1.581, 2);
    expect(v[1]).toBe(0);
  });
});
