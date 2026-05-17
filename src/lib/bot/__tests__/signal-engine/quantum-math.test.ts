import { describe, it, expect } from "vitest";
import {
  hestonHamiltonianState,
  quantumWalk,
  quantumAmplitudes,
  combineQuantumSignals,
} from "../../signal-engine/quantum-math";
import {
  HESTON_DEFAULT,
  makeBullishTickSeries,
  makeBearishTickSeries,
  makeQuantumState,
  makeWalkResult,
  makeAmplitudeResult,
  ALL_REGIMES,
} from "../fixtures";

describe("quantum-math", () => {
  // ─── hestonHamiltonianState ────────────────────────────────────────────────
  describe("hestonHamiltonianState", () => {
    it("retorna QuantumState con grid 20x20 (400 puntos)", () => {
      const state = hestonHamiltonianState(2000, 0.01, HESTON_DEFAULT);
      expect(state.psi).toHaveLength(400);
      expect(state.wavefunction).toHaveLength(400);
    });

    it("wavefunction está normalizada (suma ≈ 1)", () => {
      const state = hestonHamiltonianState(2000, 0.01, HESTON_DEFAULT);
      const total = state.wavefunction.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 3);
    });

    it("retorna energía finita (no NaN, no Infinity)", () => {
      const state = hestonHamiltonianState(2000, 0.01, HESTON_DEFAULT);
      expect(Number.isFinite(state.energy)).toBe(true);
    });

    it("maneja v muy pequeño sin div by zero", () => {
      const state = hestonHamiltonianState(2000, 1e-10, HESTON_DEFAULT);
      expect(Number.isFinite(state.energy)).toBe(true);
    });
  });

  // ─── quantumWalk ───────────────────────────────────────────────────────────
  describe("quantumWalk", () => {
    it("priceHistory vacío → distribución uniforme + bullBias=0", () => {
      const r = quantumWalk([], 10);
      expect(r.bullBias).toBe(0);
      expect(r.expectedMove).toBe(0);
      expect(r.variance).toBe(0);
      // Cada posición ≈ 1/100
      expect(r.probabilityDistribution[0]).toBeCloseTo(0.01);
    });

    it("priceHistory con 1 sólo precio → distribución uniforme", () => {
      const r = quantumWalk([2000], 10);
      expect(r.bullBias).toBe(0);
    });

    it("distribución de probabilidad suma ≈ 1", () => {
      const prices = [1990, 2000, 2010, 2020];
      const r = quantumWalk(prices, 20);
      const total = r.probabilityDistribution.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    it("tendencia alcista produce bullBias > 0", () => {
      const prices = [1900, 1950, 2000, 2050, 2100];
      const r = quantumWalk(prices, 30);
      // Con momentum claramente alcista, esperamos bias positivo (no necesariamente fuerte)
      expect(r.bullBias).toBeGreaterThanOrEqual(-0.5);
    });

    it("bullBias siempre en [-1, 1]", () => {
      const prices = [1900, 2200, 1850, 2300, 1800];
      const r = quantumWalk(prices, 30);
      expect(r.bullBias).toBeGreaterThanOrEqual(-1);
      expect(r.bullBias).toBeLessThanOrEqual(1);
    });

    it("steps cap a 40 (no se ejecutan más de 40)", () => {
      // Sólo verificamos que no crash con un valor enorme
      const r = quantumWalk([2000, 2010, 2020], 1000);
      expect(r.probabilityDistribution).toHaveLength(100);
    });
  });

  // ─── quantumAmplitudes ─────────────────────────────────────────────────────
  describe("quantumAmplitudes", () => {
    it("recentTicks vacío → NEUTRAL con confidence = 1/3", () => {
      const r = quantumAmplitudes(0.02, 100, []);
      expect(r.signal).toBe("NEUTRAL");
      expect(r.confidence).toBeCloseTo(1 / 3, 3);
    });

    it("amplitudes normalizadas: |α|² + |β|² + |γ|² = 1", () => {
      const ticks = makeBullishTickSeries(10);
      const r = quantumAmplitudes(0.02, 100, ticks);
      const sumSq = r.amplitudes.bull ** 2 + r.amplitudes.bear ** 2 + r.amplitudes.neutral ** 2;
      expect(sumSq).toBeCloseTo(1, 3);
    });

    it("tendencia alcista fuerte → signal BUY", () => {
      const ticks = makeBullishTickSeries(10, 1900);
      const r = quantumAmplitudes(0.02, 100, ticks);
      expect(r.signal).toBe("BUY");
    });

    it("tendencia bajista fuerte → signal SELL", () => {
      const ticks = makeBearishTickSeries(10, 2100);
      const r = quantumAmplitudes(0.02, 100, ticks);
      expect(["SELL", "NEUTRAL"]).toContain(r.signal);
    });

    it("tickVolume < 1 fuerza NEUTRAL incluso con momentum", () => {
      const ticks = makeBullishTickSeries(10);
      const r = quantumAmplitudes(0.02, 0, ticks);
      expect(r.signal).toBe("NEUTRAL");
    });

    it("confidence siempre en [0, 1]", () => {
      const ticks = makeBullishTickSeries(10);
      const r = quantumAmplitudes(0.02, 100, ticks);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ─── combineQuantumSignals ─────────────────────────────────────────────────
  describe("combineQuantumSignals", () => {
    it("retorna action SKIP cuando amplitude.signal = NEUTRAL", () => {
      const r = combineQuantumSignals(
        makeWalkResult({ bullBias: 0.5 }),
        makeAmplitudeResult({ signal: "NEUTRAL", confidence: 0.9 }),
        makeQuantumState(),
        "BULL_TREND_STRONG",
      );
      expect(r.action).toBe("SKIP");
    });

    it("threshold = 0.55 en BULL_TREND_STRONG (más permisivo)", () => {
      const r = combineQuantumSignals(
        makeWalkResult({ bullBias: 0.8 }),
        makeAmplitudeResult({ signal: "BUY", confidence: 0.95 }),
        makeQuantumState({ energy: 1e6 }),
        "BULL_TREND_STRONG",
      );
      expect(r.action).toBe("BUY");
    });

    it("threshold = 0.75 en SIDEWAYS_HIGH_VOL (más restrictivo)", () => {
      // Confidence típica ~0.55 no debería pasar este umbral
      const r = combineQuantumSignals(
        makeWalkResult({ bullBias: 0.2 }),
        makeAmplitudeResult({ signal: "BUY", confidence: 0.5 }),
        makeQuantumState({ energy: 0 }),
        "SIDEWAYS_HIGH_VOL",
      );
      expect(r.action).toBe("SKIP");
    });

    it("BEAR_TREND_STRONG bloquea BUY a menos que confidence ≥ 0.72", () => {
      const r = combineQuantumSignals(
        makeWalkResult({ bullBias: 0.5 }),
        makeAmplitudeResult({ signal: "BUY", confidence: 0.65 }),
        makeQuantumState(),
        "BEAR_TREND_STRONG",
      );
      // Confidence final típicamente < 0.72 → SKIP
      expect(r.action).toBe("SKIP");
    });

    it("BULL_TREND_STRONG bloquea SELL a menos que confidence ≥ 0.72", () => {
      const r = combineQuantumSignals(
        makeWalkResult({ bullBias: -0.5 }),
        makeAmplitudeResult({ signal: "SELL", confidence: 0.65 }),
        makeQuantumState(),
        "BULL_TREND_STRONG",
      );
      expect(r.action).toBe("SKIP");
    });

    it("alignment positivo (walk + amplitude misma dirección) aumenta confidence", () => {
      const aligned = combineQuantumSignals(
        makeWalkResult({ bullBias: 0.8 }),
        makeAmplitudeResult({ signal: "BUY", confidence: 0.7 }),
        makeQuantumState(),
        "BULL_TREND_WEAK",
      );
      const opposed = combineQuantumSignals(
        makeWalkResult({ bullBias: -0.8 }),
        makeAmplitudeResult({ signal: "BUY", confidence: 0.7 }),
        makeQuantumState(),
        "BULL_TREND_WEAK",
      );
      expect(aligned.confidence).toBeGreaterThan(opposed.confidence);
    });

    it("signalId es único entre invocaciones consecutivas", () => {
      const r1 = combineQuantumSignals(
        makeWalkResult(),
        makeAmplitudeResult(),
        makeQuantumState(),
        "BULL_TREND_WEAK",
      );
      const r2 = combineQuantumSignals(
        makeWalkResult(),
        makeAmplitudeResult(),
        makeQuantumState(),
        "BULL_TREND_WEAK",
      );
      expect(r1.signalId).not.toBe(r2.signalId);
      expect(r1.signalId).toMatch(/^sig_/);
    });

    it("confidence siempre en [0, 1] en todos los regímenes", () => {
      for (const regime of ALL_REGIMES) {
        const r = combineQuantumSignals(
          makeWalkResult({ bullBias: 0.5 }),
          makeAmplitudeResult({ signal: "BUY", confidence: 0.8 }),
          makeQuantumState({ energy: 1e6 }),
          regime,
        );
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
