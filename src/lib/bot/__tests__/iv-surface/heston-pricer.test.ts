import { describe, it, expect } from "vitest";
import { calculateIVSurface, estimateHestonParams } from "../../iv-surface/heston-pricer";
import { HESTON_DEFAULT } from "../fixtures";

describe("heston-pricer", () => {
  describe("calculateIVSurface", () => {
    it("retorna 147 puntos (21 strikes × 7 expiries)", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      expect(surface.points).toHaveLength(21 * 7);
    });

    it("strikes en moneyness 0.85-1.15", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      expect(surface.strikes[0]).toBeCloseTo(0.85, 5);
      expect(surface.strikes[20]).toBeCloseTo(1.15, 5);
    });

    it("expiries incluye 1d, 7d, 14d, 1m, 3m, 6m, 1y", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      expect(surface.expiries).toHaveLength(7);
      expect(surface.expiries[0]).toBeCloseTo(1 / 365, 5);
      expect(surface.expiries[6]).toBeCloseTo(1.0, 5);
    });

    it("spot se preserva en el output", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2500);
      expect(surface.spot).toBe(2500);
    });

    it("computedAt es ISO timestamp", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      expect(surface.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("cada SurfacePoint tiene strike, moneyness, expiry, iv, callPrice", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      const p = surface.points[0];
      expect(p.strike).toBeGreaterThan(0);
      expect(p.moneyness).toBeGreaterThan(0);
      expect(p.expiry).toBeGreaterThan(0);
      expect(p.iv).toBeGreaterThanOrEqual(0.001);
      expect(p.iv).toBeLessThanOrEqual(5.0);
    });

    it("iv clampada en [0.001, 5.0]", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      for (const p of surface.points) {
        expect(p.iv).toBeGreaterThanOrEqual(0.001);
        expect(p.iv).toBeLessThanOrEqual(5.0);
      }
    });

    it("callPrice >= 0 para todos los puntos", () => {
      const surface = calculateIVSurface(HESTON_DEFAULT, 2000);
      for (const p of surface.points) {
        expect(p.callPrice).toBeGreaterThanOrEqual(0);
      }
    });

    it("strike = spot * moneyness para cada punto", () => {
      const spot = 2000;
      const surface = calculateIVSurface(HESTON_DEFAULT, spot);
      for (const p of surface.points) {
        expect(p.strike).toBeCloseTo(spot * p.moneyness, 5);
      }
    });

    it("call prices ITM (K << S) tienden a ser >= intrinsic", () => {
      const spot = 2000;
      const surface = calculateIVSurface(HESTON_DEFAULT, spot);
      // El strike más bajo (moneyness=0.85, K=1700) y expiry más alto (1y)
      const deepITM = surface.points.find((p) => p.moneyness === 0.85 && Math.abs(p.expiry - 1) < 0.01);
      expect(deepITM).toBeDefined();
      const intrinsic = Math.max(spot - deepITM!.strike * Math.exp(-0.045 * 1), 0);
      expect(deepITM!.callPrice).toBeGreaterThanOrEqual(intrinsic * 0.99); // tolerancia numérica
    });
  });

  describe("estimateHestonParams", () => {
    it("devuelve fallback con menos de 10 ticks", () => {
      const ticks = Array.from({ length: 5 }, (_, i) => ({
        last: 2000 + i, bid: 2000 + i, ask: 2000.02 + i,
      }));
      const r = estimateHestonParams(ticks, HESTON_DEFAULT);
      expect(r).toEqual(HESTON_DEFAULT);
    });

    it("estima v0 > 0 a partir de movimiento de precios", () => {
      const ticks = Array.from({ length: 20 }, (_, i) => ({
        last: 2000 + Math.sin(i) * 5, bid: 1999.5 + Math.sin(i) * 5, ask: 2000.5 + Math.sin(i) * 5,
      }));
      const r = estimateHestonParams(ticks, HESTON_DEFAULT);
      expect(r.v0).toBeGreaterThan(0);
      expect(r.theta).toBeGreaterThan(0);
    });

    it("kappa y rho se preservan del fallback (no estimables)", () => {
      const ticks = Array.from({ length: 20 }, (_, i) => ({
        last: 2000 + i, bid: 1999.5 + i, ask: 2000.5 + i,
      }));
      const r = estimateHestonParams(ticks, HESTON_DEFAULT);
      expect(r.kappa).toBe(HESTON_DEFAULT.kappa);
      expect(r.rho).toBe(HESTON_DEFAULT.rho);
    });

    it("sigma clampada en [0.1, 1.5]", () => {
      const ticks = Array.from({ length: 20 }, (_, i) => ({
        last: 2000 + i, bid: 1999 + i, ask: 2001 + i, // spread relativamente alto
      }));
      const r = estimateHestonParams(ticks, HESTON_DEFAULT);
      expect(r.sigma).toBeGreaterThanOrEqual(0.1);
      expect(r.sigma).toBeLessThanOrEqual(1.5);
    });

    it("v0 mínimo 0.0001 (floor para evitar log(0))", () => {
      // Precios idénticos → varianza=0
      const ticks = Array.from({ length: 20 }, () => ({
        last: 2000, bid: 1999.5, ask: 2000.5,
      }));
      const r = estimateHestonParams(ticks, HESTON_DEFAULT);
      expect(r.v0).toBeGreaterThanOrEqual(0.0001);
    });
  });
});
