import { describe, it, expect } from "vitest";
import { detectLiquidityZones } from "../src/analysis/liquidity-map.js";

interface CandleRest {
  start: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

function candle(start: number, low: number, high: number): CandleRest {
  return { start, low, high, open: (low + high) / 2, close: (low + high) / 2, volume: 1 };
}

describe("detectLiquidityZones", () => {
  it("retorna [] cuando hay menos de 11 candles", () => {
    const candles = Array.from({ length: 5 }, (_, i) => candle(i, 90, 100));
    expect(detectLiquidityZones("BTC-USD", "1H", candles)).toEqual([]);
  });

  it("detecta swing high cuando un candle tiene high > vecinos en ±5", () => {
    const candles: CandleRest[] = [];
    for (let i = 0; i < 15; i++) {
      candles.push(candle(i, 90, i === 7 ? 110 : 100)); // peak en idx 7
    }
    const zones = detectLiquidityZones("BTC-USD", "1H", candles);
    expect(zones.length).toBeGreaterThanOrEqual(1);
    expect(zones.some((z) => z.zoneType === "SWING_HIGH" || z.zoneType === "EQH")).toBe(true);
  });

  it("detecta swing low cuando un candle tiene low < vecinos en ±5", () => {
    const candles: CandleRest[] = [];
    for (let i = 0; i < 15; i++) {
      candles.push(candle(i, i === 7 ? 80 : 90, 100));
    }
    const zones = detectLiquidityZones("BTC-USD", "1H", candles);
    expect(zones.some((z) => z.zoneType === "SWING_LOW" || z.zoneType === "EQL")).toBe(true);
  });

  it("no detecta swing en los bordes (no hay suficientes vecinos)", () => {
    const candles: CandleRest[] = [];
    for (let i = 0; i < 15; i++) {
      // Highs en bordes (idx 0, 14) deberían ser ignorados
      const h = (i === 0 || i === 14) ? 200 : 100;
      candles.push(candle(i, 90, h));
    }
    const zones = detectLiquidityZones("BTC-USD", "1H", candles);
    // No detectaríamos esos picos en los bordes
    expect(zones.every((z) => {
      const mid = (z.priceTop + z.priceBottom) / 2;
      return mid < 200;
    })).toBe(true);
  });

  it("merge nearby + EQH cuando hay múltiples swing highs al mismo precio", () => {
    const candles: CandleRest[] = [];
    // Creamos 2 swing highs idénticos en idx 7 e idx 25
    for (let i = 0; i < 40; i++) {
      let h = 100;
      if (i === 7 || i === 25) h = 110.0;
      candles.push(candle(i, 90, h));
    }
    const zones = detectLiquidityZones("BTC-USD", "1H", candles);
    // Esperamos un EQH (merge de 2 swing highs cerca del mismo precio)
    const eqh = zones.find((z) => z.zoneType === "EQH");
    expect(eqh).toBeDefined();
    expect(eqh!.strength).toBeGreaterThanOrEqual(2);
  });

  it("preserva symbol y timeframe en cada zone", () => {
    const candles: CandleRest[] = [];
    for (let i = 0; i < 15; i++) {
      candles.push(candle(i, 90, i === 7 ? 110 : 100));
    }
    const zones = detectLiquidityZones("ETH-USD", "4H", candles);
    expect(zones[0].symbol).toBe("ETH-USD");
    expect(zones[0].timeframe).toBe("4H");
  });

  it("priceBottom y priceTop están ±0.1% alrededor del nivel detectado", () => {
    const candles: CandleRest[] = [];
    for (let i = 0; i < 15; i++) {
      candles.push(candle(i, 90, i === 7 ? 100 : 95));
    }
    const zones = detectLiquidityZones("BTC-USD", "1H", candles);
    const swingHigh = zones.find((z) => z.zoneType === "SWING_HIGH");
    expect(swingHigh).toBeDefined();
    expect(swingHigh!.priceTop).toBeCloseTo(100 * 1.001, 4);
    expect(swingHigh!.priceBottom).toBeCloseTo(100 * 0.999, 4);
  });
});
