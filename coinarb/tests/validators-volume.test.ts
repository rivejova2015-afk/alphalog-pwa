import { describe, it, expect } from "vitest";
import { computeVolumeDelta, deltaAgreesWith } from "../src/validators/volume-delta.js";
import { computeVolumeProfile, priceInValueArea } from "../src/validators/volume-profile.js";
import type { PriceSample } from "../src/feeds/coinbase-ws.js";

function makeSamples(prices: number[], spacingMs = 1000, endTs = Date.now()): PriceSample[] {
  const startTs = endTs - prices.length * spacingMs;
  return prices.map((price, i) => ({
    timestamp: startTs + i * spacingMs,
    price,
  } as PriceSample));
}

// ─── computeVolumeDelta ──────────────────────────────────────────────────────

describe("computeVolumeDelta", () => {
  it("samples < 2 → delta=0, confidence=0", () => {
    const r = computeVolumeDelta([]);
    expect(r.delta).toBe(0);
    expect(r.confidence).toBe(0);
    expect(r.windowSamples).toBe(0);
  });

  it("una sola sample → delta=0", () => {
    const r = computeVolumeDelta(makeSamples([100]));
    expect(r.delta).toBe(0);
  });

  it("todas upticks → delta=+1", () => {
    const r = computeVolumeDelta(makeSamples(Array.from({ length: 40 }, (_, i) => 100 + i)));
    expect(r.delta).toBe(1);
    expect(r.upticks).toBe(39);
    expect(r.downticks).toBe(0);
  });

  it("todas downticks → delta=-1", () => {
    const r = computeVolumeDelta(makeSamples(Array.from({ length: 40 }, (_, i) => 140 - i)));
    expect(r.delta).toBe(-1);
    expect(r.upticks).toBe(0);
    expect(r.downticks).toBe(39);
  });

  it("alternados (up/down) → delta cercano a 0", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + (i % 2 === 0 ? 1 : -1));
    const r = computeVolumeDelta(makeSamples(prices));
    expect(Math.abs(r.delta)).toBeLessThan(0.1);
  });

  it("confidence=0 cuando samples < MIN_SAMPLES (30)", () => {
    const r = computeVolumeDelta(makeSamples(Array.from({ length: 20 }, (_, i) => 100 + i)));
    expect(r.confidence).toBe(0);
  });

  it("confidence > 0 cuando samples >= MIN_SAMPLES", () => {
    const r = computeVolumeDelta(makeSamples(Array.from({ length: 100 }, (_, i) => 100 + i)));
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("filtra samples fuera de windowMs", () => {
    // 50 samples antiguos + 50 recientes
    const oldSamples = makeSamples(Array.from({ length: 50 }, () => 100), 1000, Date.now() - 10 * 60 * 1000);
    const newSamples = makeSamples(Array.from({ length: 50 }, (_, i) => 100 + i), 1000, Date.now());
    const r = computeVolumeDelta([...oldSamples, ...newSamples], 5 * 60 * 1000);
    expect(r.windowSamples).toBe(50); // solo los recientes
  });

  it("ticks iguales (sin diff) → delta=0", () => {
    const r = computeVolumeDelta(makeSamples(Array.from({ length: 40 }, () => 100)));
    expect(r.delta).toBe(0);
  });
});

describe("deltaAgreesWith", () => {
  it("BUY + delta positivo >= threshold → true", () => {
    expect(deltaAgreesWith("BUY", 0.5)).toBe(true);
    expect(deltaAgreesWith("BUY", 0.2)).toBe(true);
  });
  it("BUY + delta < threshold → false", () => {
    expect(deltaAgreesWith("BUY", 0.1)).toBe(false);
    expect(deltaAgreesWith("BUY", -0.5)).toBe(false);
  });
  it("SELL + delta negativo <= -threshold → true", () => {
    expect(deltaAgreesWith("SELL", -0.5)).toBe(true);
    expect(deltaAgreesWith("SELL", -0.2)).toBe(true);
  });
  it("SELL + delta > -threshold → false", () => {
    expect(deltaAgreesWith("SELL", -0.1)).toBe(false);
    expect(deltaAgreesWith("SELL", 0.5)).toBe(false);
  });
  it("custom threshold respetado", () => {
    expect(deltaAgreesWith("BUY", 0.3, 0.5)).toBe(false);
    expect(deltaAgreesWith("BUY", 0.6, 0.5)).toBe(true);
  });
});

// ─── computeVolumeProfile ────────────────────────────────────────────────────

describe("computeVolumeProfile", () => {
  it("samples < 50 → todo null", () => {
    const r = computeVolumeProfile(makeSamples([100, 110, 120]));
    expect(r.poc).toBeNull();
    expect(r.vahigh).toBeNull();
    expect(r.valow).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it("max === min (todos los precios iguales) → null", () => {
    const r = computeVolumeProfile(makeSamples(Array.from({ length: 100 }, () => 100)));
    expect(r.poc).toBeNull();
  });

  it("distribución concentrada → POC cerca del precio dominante", () => {
    // 90 samples a precio ~100 + 10 outliers
    const samples: PriceSample[] = [
      ...makeSamples(Array.from({ length: 90 }, () => 100 + (Math.random() - 0.5) * 0.5)),
      ...makeSamples(Array.from({ length: 10 }, () => 200)),
    ];
    const r = computeVolumeProfile(samples);
    expect(r.poc).not.toBeNull();
    expect(r.poc!).toBeGreaterThan(95);
    expect(r.poc!).toBeLessThan(105);
  });

  it("VAH ≥ POC ≥ VAL", () => {
    const samples = makeSamples(Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 10) * 20));
    const r = computeVolumeProfile(samples);
    expect(r.vahigh).not.toBeNull();
    expect(r.valow).not.toBeNull();
    expect(r.vahigh!).toBeGreaterThanOrEqual(r.poc!);
    expect(r.poc!).toBeGreaterThanOrEqual(r.valow!);
  });

  it("confidence crece linealmente con sample count (max 1)", () => {
    const r = computeVolumeProfile(makeSamples(Array.from({ length: 500 }, (_, i) => 100 + i * 0.01)));
    expect(r.confidence).toBe(1);
  });
});

describe("priceInValueArea", () => {
  it("retorna true si VAH/VAL son null (no profile válido)", () => {
    expect(priceInValueArea(100, { poc: null, vahigh: null, valow: null, confidence: 0 })).toBe(true);
  });
  it("price dentro de [VAL, VAH] → true", () => {
    expect(priceInValueArea(100, { poc: 100, vahigh: 110, valow: 90, confidence: 0.8 })).toBe(true);
    expect(priceInValueArea(90, { poc: 100, vahigh: 110, valow: 90, confidence: 0.8 })).toBe(true);
    expect(priceInValueArea(110, { poc: 100, vahigh: 110, valow: 90, confidence: 0.8 })).toBe(true);
  });
  it("price fuera del rango → false", () => {
    expect(priceInValueArea(89, { poc: 100, vahigh: 110, valow: 90, confidence: 0.8 })).toBe(false);
    expect(priceInValueArea(111, { poc: 100, vahigh: 110, valow: 90, confidence: 0.8 })).toBe(false);
  });
});
