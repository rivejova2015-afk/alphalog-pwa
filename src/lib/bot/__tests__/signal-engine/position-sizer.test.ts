import { describe, it, expect } from "vitest";
import { calculatePositionSize } from "../../signal-engine/position-sizer";
import { makeSizerParams, makeRecentTrade, makeCombinedSignal } from "../fixtures";

describe("position-sizer", () => {
  describe("calculatePositionSize - circuit breaker", () => {
    it("bloquea cuando dailyPnlPct = -0.25 exacto", () => {
      const r = calculatePositionSize(makeSizerParams({ dailyPnlPct: -0.25 }));
      expect(r.blocked).toBe(true);
      expect(r.reason).toBe("CIRCUIT_BREAKER_25PCT");
      expect(r.lots).toBe(0);
      expect(r.kellyFraction).toBe(0);
      expect(r.volScalar).toBe(0);
    });

    it("bloquea cuando dailyPnlPct = -0.30 (más allá del umbral)", () => {
      const r = calculatePositionSize(makeSizerParams({ dailyPnlPct: -0.30 }));
      expect(r.blocked).toBe(true);
      expect(r.lots).toBe(0);
    });

    it("permite operar cuando dailyPnlPct = -0.20", () => {
      const r = calculatePositionSize(makeSizerParams({ dailyPnlPct: -0.20 }));
      expect(r.blocked).toBe(false);
      expect(r.lots).toBeGreaterThan(0);
    });
  });

  describe("calculatePositionSize - Kelly clamping", () => {
    it("Kelly fraction siempre ≥ 0.001 (piso)", () => {
      // recentTrades muy malos → kelly raw negativo → clamped a 0.001
      const losers = Array.from({ length: 10 }, () => makeRecentTrade({ pnl: -100 }));
      const r = calculatePositionSize(makeSizerParams({ recentTrades: losers }));
      expect(r.kellyFraction).toBeGreaterThanOrEqual(0.001);
    });

    it("Kelly fraction siempre ≤ 0.05 (techo)", () => {
      // recentTrades excelentes → kelly raw alto → clamped a 0.05
      const winners = Array.from({ length: 20 }, () => makeRecentTrade({ pnl: 500 }));
      const r = calculatePositionSize(makeSizerParams({ recentTrades: winners }));
      expect(r.kellyFraction).toBeLessThanOrEqual(0.05);
    });

    it("usa defaults conservadores cuando recentTrades está vacío", () => {
      const r = calculatePositionSize(makeSizerParams({ recentTrades: [] }));
      expect(r.blocked).toBe(false);
      expect(r.kellyFraction).toBeGreaterThan(0);
      expect(r.lots).toBeGreaterThan(0);
    });
  });

  describe("calculatePositionSize - vol-targeting", () => {
    it("volScalar bajo cuando volatilidad actual >> target", () => {
      const r = calculatePositionSize(makeSizerParams({
        currentVol15m: 0.02, // 4× target
        volTarget: 0.005,
      }));
      // volScalar clamped a 0.5 mínimo
      expect(r.volScalar).toBe(0.5);
    });

    it("volScalar alto cuando volatilidad actual << target", () => {
      const r = calculatePositionSize(makeSizerParams({
        currentVol15m: 0.001, // 1/5 target
        volTarget: 0.005,
      }));
      // volScalar clamped a 2.0 máximo
      expect(r.volScalar).toBe(2.0);
    });

    it("volScalar = 1 cuando vol actual = target", () => {
      const r = calculatePositionSize(makeSizerParams({
        currentVol15m: 0.005,
        volTarget: 0.005,
      }));
      expect(r.volScalar).toBe(1.0);
    });
  });

  describe("calculatePositionSize - lot limits", () => {
    it("lots respeta el máximo absoluto de 5.0", () => {
      const winners = Array.from({ length: 20 }, () => makeRecentTrade({ pnl: 1000 }));
      const r = calculatePositionSize(makeSizerParams({
        currentEquity: 1_000_000,
        recentTrades: winners,
        signal: makeCombinedSignal({ confidence: 1 }),
      }));
      expect(r.lots).toBeLessThanOrEqual(5.0);
    });

    it("lots respeta el mínimo absoluto de 0.01", () => {
      const r = calculatePositionSize(makeSizerParams({
        currentEquity: 100,
        signal: makeCombinedSignal({ confidence: 0.1 }),
      }));
      expect(r.lots).toBeGreaterThanOrEqual(0.01);
    });

    it("lots reduce proporcionalmente a la confianza de la señal", () => {
      const high = calculatePositionSize(makeSizerParams({
        signal: makeCombinedSignal({ confidence: 0.9 }),
      }));
      const low = calculatePositionSize(makeSizerParams({
        signal: makeCombinedSignal({ confidence: 0.3 }),
      }));
      expect(high.lots).toBeGreaterThanOrEqual(low.lots);
    });
  });
});
