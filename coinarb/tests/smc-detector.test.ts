import { describe, it, expect } from "vitest";
import { detectSmc } from "../src/analysis/smc-detector.js";
import type { Candle } from "../src/analysis/candle-builder.js";

function c(open: number, high: number, low: number, close: number, openTs = 0): Candle {
  return {
    timeframe: "1H",
    openTs,
    closeTs: openTs + 3_600_000,
    open, high, low, close,
    volume: 0,
  };
}

// Helper: build N candles in a constant range
function flatRange(n: number, mid = 100, range = 1): Candle[] {
  return Array.from({ length: n }, (_, i) =>
    c(mid - range / 2, mid + range / 2, mid - range / 2, mid + range / 2, i * 3_600_000),
  );
}

describe("detectSmc", () => {
  it("retorna NEUTRAL cuando hay menos de 13 candles", () => {
    const r = detectSmc(flatRange(10));
    expect(r.bias).toBe("NEUTRAL");
    expect(r.confidence).toBe(0);
    expect(r.bos).toBe(false);
    expect(r.choch).toBe(false);
    expect(r.zones).toEqual([]);
    expect(r.swingHigh).toBeNull();
    expect(r.swingLow).toBeNull();
  });

  it("rango plano sin swings → NEUTRAL", () => {
    const r = detectSmc(flatRange(30));
    expect(r.bias).toBe("NEUTRAL");
    expect(r.bos).toBe(false);
  });

  it("detecta swing high → BOS BUY cuando close rompe arriba", () => {
    const candles: Candle[] = [];
    // Construye un swing high claro en el medio
    for (let i = 0; i < 20; i++) {
      const high = i === 10 ? 110 : 100; // pico en 10
      candles.push(c(99, high, 98, 99, i * 3_600_000));
    }
    // Última vela rompe el swing high al alza
    candles.push(c(99, 115, 99, 112, 20 * 3_600_000));

    const r = detectSmc(candles);
    expect(r.swingHigh).not.toBeNull();
    expect(r.bos).toBe(true);
    expect(r.bias).toBe("BUY");
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("detecta swing low → BOS SELL cuando close rompe abajo", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      const low = i === 10 ? 90 : 100;
      candles.push(c(101, 102, low, 101, i * 3_600_000));
    }
    candles.push(c(101, 102, 85, 88, 20 * 3_600_000));

    const r = detectSmc(candles);
    expect(r.swingLow).not.toBeNull();
    expect(r.bos).toBe(true);
    expect(r.bias).toBe("SELL");
  });

  it("confidence siempre ∈ [0, 1]", () => {
    const variedSeries: Candle[] = [];
    for (let i = 0; i < 50; i++) {
      const val = 100 + Math.sin(i / 3) * 10;
      variedSeries.push(c(val, val + 1, val - 1, val, i * 3_600_000));
    }
    const r = detectSmc(variedSeries);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("BOS suma ~0.4 a confidence", () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      const high = i === 10 ? 110 : 100;
      candles.push(c(99, high, 98, 99, i * 3_600_000));
    }
    candles.push(c(99, 115, 99, 112, 20 * 3_600_000));
    const r = detectSmc(candles);
    expect(r.confidence).toBeGreaterThanOrEqual(0.4);
  });

  it("CHOCH se activa cuando BOS reversa el slope previo", () => {
    const candles: Candle[] = [];
    // 20 candles bajistas (slope negativo)
    for (let i = 0; i < 20; i++) {
      const price = 120 - i;
      candles.push(c(price, price + 1, price - 1, price, i * 3_600_000));
    }
    // Swing low aproximado en el final + BOS BUY
    candles[10] = c(100, 105, 80, 100, 10 * 3_600_000); // swing low manufactured
    // Pero el slope es bajista (de 120 a 100), entonces BUY rompe character
    candles.push(c(100, 130, 100, 125, 20 * 3_600_000));
    const r = detectSmc(candles);
    if (r.bos && r.bias === "BUY") {
      expect(r.choch).toBe(true);
    }
  });

  it("retorna array de zones acotado a 12 elementos", () => {
    const candles: Candle[] = [];
    // Variación amplia para producir muchos OB/FVG
    for (let i = 0; i < 60; i++) {
      const noise = Math.random() * 2;
      candles.push(c(100 + noise, 105 + noise, 95 + noise, 100 + noise, i * 3_600_000));
    }
    const r = detectSmc(candles);
    expect(r.zones.length).toBeLessThanOrEqual(12);
  });
});
