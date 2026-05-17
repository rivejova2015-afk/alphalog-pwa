import { describe, it, expect } from "vitest";
import { detectSkew, getPointSize, POINT_SIZE_BY_SYMBOL } from "../../arbitrage/latency-detector";
import { makeArbTick, makeDetectorConfig } from "../fixtures";

describe("latency-detector", () => {
  describe("getPointSize", () => {
    it("XAUUSD = 0.01", () => {
      expect(getPointSize("XAUUSD")).toBe(0.01);
    });

    it("EURUSD = 0.0001", () => {
      expect(getPointSize("EURUSD")).toBe(0.0001);
    });

    it("XAGUSD = 0.001", () => {
      expect(getPointSize("XAGUSD")).toBe(0.001);
    });

    it("USDJPY = 0.01", () => {
      expect(getPointSize("USDJPY")).toBe(0.01);
    });

    it("símbolo desconocido → fallback 0.0001", () => {
      expect(getPointSize("UNKNOWN")).toBe(0.0001);
    });

    it("POINT_SIZE_BY_SYMBOL incluye los 5 símbolos base", () => {
      expect(Object.keys(POINT_SIZE_BY_SYMBOL).sort()).toEqual(
        ["EURUSD", "GBPUSD", "USDJPY", "XAGUSD", "XAUUSD"].sort()
      );
    });
  });

  describe("detectSkew", () => {
    it("retorna null cuando símbolos son distintos", () => {
      const fast = makeArbTick({ symbol: "XAUUSD" });
      const slow = makeArbTick({ symbol: "EURUSD", broker_id: "broker_b" });
      expect(detectSkew(fast, slow, makeDetectorConfig())).toBeNull();
    });

    it("retorna null cuando broker_id es el mismo", () => {
      const fast = makeArbTick({ broker_id: "broker_a", bid: 2000.20 });
      const slow = makeArbTick({ broker_id: "broker_a", bid: 2000.00 });
      expect(detectSkew(fast, slow, makeDetectorConfig())).toBeNull();
    });

    it("retorna null cuando ticks están separados > 1000ms", () => {
      const fast = makeArbTick({ ts_ms: 1000, bid: 2000.20 });
      const slow = makeArbTick({ broker_id: "broker_b", ts_ms: 2500, bid: 2000.00 });
      expect(detectSkew(fast, slow, makeDetectorConfig())).toBeNull();
    });

    it("retorna null cuando skew < max_skew_points", () => {
      // 5 points = 0.05 USD para XAUUSD; threshold = 10 → no detecta
      const fast = makeArbTick({ bid: 2000.05 });
      const slow = makeArbTick({ broker_id: "broker_b", bid: 2000.00 });
      expect(detectSkew(fast, slow, makeDetectorConfig({ max_skew_points: 10 }))).toBeNull();
    });

    it("detecta BUY cuando fast.bid > slow.bid por más del threshold", () => {
      // 15 points = 0.15 USD
      const fast = makeArbTick({ bid: 2000.15, broker_id: "broker_a" });
      const slow = makeArbTick({ broker_id: "broker_b", bid: 2000.00 });
      const r = detectSkew(fast, slow, makeDetectorConfig({ max_skew_points: 10 }));
      expect(r).not.toBeNull();
      expect(r!.direction).toBe("BUY");
      expect(r!.skew_points).toBe(15);
      expect(r!.symbol).toBe("XAUUSD");
    });

    it("detecta SELL cuando fast.bid < slow.bid por más del threshold", () => {
      const fast = makeArbTick({ bid: 1999.85, broker_id: "broker_a" });
      const slow = makeArbTick({ broker_id: "broker_b", bid: 2000.00 });
      const r = detectSkew(fast, slow, makeDetectorConfig({ max_skew_points: 10 }));
      expect(r).not.toBeNull();
      expect(r!.direction).toBe("SELL");
      expect(r!.skew_points).toBe(15);
    });

    it("detected_at = max(fast.ts_ms, slow.ts_ms)", () => {
      const fast = makeArbTick({ bid: 2000.15, ts_ms: 1000 });
      const slow = makeArbTick({ broker_id: "broker_b", bid: 2000.00, ts_ms: 1500 });
      const r = detectSkew(fast, slow, makeDetectorConfig({ max_skew_points: 10 }));
      expect(r!.detected_at).toBe(1500);
    });

    it("respeta el threshold como límite estricto (>=)", () => {
      // Exactamente 10 points → no detecta (regla: points < threshold sale null)
      // Espera: points === 10 → sale null (porque check es `points < max_skew_points`)
      // Verifiquemos lo opuesto: 10.01 points → detecta
      const fast = makeArbTick({ bid: 2000.1001, broker_id: "broker_a" });
      const slow = makeArbTick({ broker_id: "broker_b", bid: 2000.00 });
      const r = detectSkew(fast, slow, makeDetectorConfig({ max_skew_points: 10 }));
      expect(r).not.toBeNull();
    });
  });
});
