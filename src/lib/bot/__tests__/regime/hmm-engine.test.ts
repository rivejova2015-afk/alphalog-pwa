import { describe, it, expect } from "vitest";
import {
  getExpertInitialHMM,
  gaussianLogProb,
  extractFeatures,
  viterbi,
} from "../../regime/hmm-engine";
import type { FeatureVector } from "../../regime/hmm-engine";
import { makeBullishTickSeries, makeBearishTickSeries } from "../fixtures";

const ALL_REGIMES = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
] as const;

function makeFeatureVector(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    vol15m: 0.003,
    vol1h: 0.003,
    momentum5m: 0,
    spreadAvg: 0.0003,
    tickVolumeRatio: 1.0,
    ...overrides,
  };
}

describe("hmm-engine", () => {
  // ─── getExpertInitialHMM ──────────────────────────────────────────────────
  describe("getExpertInitialHMM", () => {
    it("retorna modelo HMM con 7 estados", () => {
      const m = getExpertInitialHMM();
      expect(m.A).toHaveLength(7);
      expect(m.mu).toHaveLength(7);
      expect(m.sigma).toHaveLength(7);
      expect(m.pi).toHaveLength(7);
    });

    it("cada fila de A suma 1 (matriz de transición válida)", () => {
      const m = getExpertInitialHMM();
      for (const row of m.A) {
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
      }
    });

    it("pi suma 1 (distribución inicial válida)", () => {
      const m = getExpertInitialHMM();
      const sum = m.pi.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    });

    it("cada estado tiene 5 features (mu y sigma)", () => {
      const m = getExpertInitialHMM();
      for (const row of m.mu) expect(row).toHaveLength(5);
      for (const row of m.sigma) expect(row).toHaveLength(5);
    });
  });

  // ─── gaussianLogProb ──────────────────────────────────────────────────────
  describe("gaussianLogProb", () => {
    it("x = mu → log-prob máxima (caso óptimo)", () => {
      const lpAtMean = gaussianLogProb(1.0, 1.0, 0.5);
      const lpFar = gaussianLogProb(5.0, 1.0, 0.5);
      expect(lpAtMean).toBeGreaterThan(lpFar);
    });

    it("sigma muy pequeña no causa div by zero", () => {
      const lp = gaussianLogProb(1.0, 1.0, 1e-15);
      expect(Number.isFinite(lp)).toBe(true);
    });

    it("retorna número finito para inputs razonables", () => {
      const lp = gaussianLogProb(0.5, 0.6, 0.1);
      expect(Number.isFinite(lp)).toBe(true);
    });
  });

  // ─── extractFeatures ──────────────────────────────────────────────────────
  describe("extractFeatures", () => {
    it("ticks vacíos → NEUTRAL_FEATURES", () => {
      const f = extractFeatures([], 15);
      expect(f.vol15m).toBe(0.003);
      expect(f.momentum5m).toBe(0);
      expect(f.tickVolumeRatio).toBe(1.0);
    });

    it("1 sólo tick → NEUTRAL_FEATURES", () => {
      const f = extractFeatures([{ bid: 2000, ask: 2002, last: 2001, volume: 100, timestamp: "2026-05-03T13:00:00Z" }], 15);
      expect(f.vol15m).toBe(0.003);
    });

    it("tendencia alcista → momentum5m > 0", () => {
      // Concentrar ticks en últimos 5 minutos
      const now = Date.parse("2026-05-03T13:05:00Z");
      const ticks = Array.from({ length: 10 }, (_, i) => ({
        bid: 1990 + i * 2,
        ask: 1990 + i * 2 + 2,
        last: 1990 + i * 2 + 1,
        volume: 100,
        timestamp: new Date(now - (10 - i) * 30_000).toISOString(),
      }));
      const f = extractFeatures(ticks, 15);
      expect(f.momentum5m).toBeGreaterThan(0);
    });

    it("tendencia bajista → momentum5m < 0", () => {
      const now = Date.parse("2026-05-03T13:05:00Z");
      const ticks = Array.from({ length: 10 }, (_, i) => ({
        bid: 2010 - i * 2,
        ask: 2010 - i * 2 + 2,
        last: 2010 - i * 2 + 1,
        volume: 100,
        timestamp: new Date(now - (10 - i) * 30_000).toISOString(),
      }));
      const f = extractFeatures(ticks, 15);
      expect(f.momentum5m).toBeLessThan(0);
    });

    it("vol15m siempre ≥ 0.0001 (floor)", () => {
      const ticks = makeBullishTickSeries(5);
      const f = extractFeatures(ticks, 15);
      expect(f.vol15m).toBeGreaterThanOrEqual(0.0001);
    });

    it("spreadAvg siempre ≥ 0", () => {
      const ticks = makeBullishTickSeries(10);
      const f = extractFeatures(ticks, 15);
      expect(f.spreadAvg).toBeGreaterThanOrEqual(0);
    });

    it("tickVolumeRatio siempre ≥ 0.01 (floor)", () => {
      const ticks = makeBullishTickSeries(10);
      const f = extractFeatures(ticks, 15);
      expect(f.tickVolumeRatio).toBeGreaterThanOrEqual(0.01);
    });
  });

  // ─── viterbi ──────────────────────────────────────────────────────────────
  describe("viterbi", () => {
    it("observaciones vacías → default SIDEWAYS_LOW_VOL con confidence uniforme", () => {
      const model = getExpertInitialHMM();
      const r = viterbi(model, []);
      expect(r.currentRegime).toBe("SIDEWAYS_LOW_VOL");
      expect(r.confidence).toBeCloseTo(1 / 7, 5);
      expect(r.path).toEqual(["SIDEWAYS_LOW_VOL"]);
    });

    it("una observación → produce un path de length 1", () => {
      const model = getExpertInitialHMM();
      const obs = [makeFeatureVector({ vol15m: 0.002, momentum5m: 0.0001 })];
      const r = viterbi(model, obs);
      expect(r.path).toHaveLength(1);
      expect(ALL_REGIMES).toContain(r.currentRegime);
    });

    it("stateProbabilities suma ≈ 1", () => {
      const model = getExpertInitialHMM();
      const obs = [makeFeatureVector(), makeFeatureVector({ momentum5m: 0.002 })];
      const r = viterbi(model, obs);
      const total = Object.values(r.stateProbabilities).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    it("confidence siempre en [0, 1]", () => {
      const model = getExpertInitialHMM();
      const obs = Array.from({ length: 10 }, () => makeFeatureVector({ vol15m: 0.008, momentum5m: 0.0015 }));
      const r = viterbi(model, obs);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });

    it("observaciones bull-like (momentum positivo) → no clasifica como BEAR", () => {
      const model = getExpertInitialHMM();
      // Features con momentum claramente positivo (cualquier estado BULL o SIDEWAYS, no BEAR)
      const obs = Array.from({ length: 20 }, () => makeFeatureVector({
        vol15m: 0.008,
        vol1h: 0.006,
        momentum5m: 0.0015,
        spreadAvg: 0.0003,
        tickVolumeRatio: 1.4,
      }));
      const r = viterbi(model, obs);
      // El estado dominante NO debería ser BEAR_TREND_STRONG ni BEAR_TREND_WEAK
      expect(r.currentRegime).not.toBe("BEAR_TREND_STRONG");
      expect(r.currentRegime).not.toBe("BEAR_TREND_WEAK");
    });

    it("path tiene length = observations.length", () => {
      const model = getExpertInitialHMM();
      const obs = Array.from({ length: 5 }, () => makeFeatureVector());
      const r = viterbi(model, obs);
      expect(r.path).toHaveLength(5);
    });
  });
});
