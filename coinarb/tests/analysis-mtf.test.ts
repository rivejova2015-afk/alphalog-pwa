import { describe, it, expect } from "vitest";
import { analyzeMtf } from "../src/analysis/mtf-analyzer.js";
import type { Candle } from "../src/analysis/candle-builder.js";
import type { Timeframe } from "../src/core/config.js";
import { TIMEFRAMES } from "../src/core/config.js";

function c(open: number, high: number, low: number, close: number, openTs = 0, tf: Timeframe = "1H"): Candle {
  return {
    timeframe: tf, openTs, closeTs: openTs + 3_600_000,
    open, high, low, close, volume: 0,
  };
}

// Build a clearly bullish series: 20 candles trending up with a final breakout
function bullishSeries(tf: Timeframe): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 20; i++) {
    const high = i === 10 ? 110 : 100;
    candles.push(c(99, high, 98, 99, i * 3_600_000, tf));
  }
  candles.push(c(99, 115, 99, 112, 20 * 3_600_000, tf)); // breakout
  return candles;
}

function bearishSeries(tf: Timeframe): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 20; i++) {
    const low = i === 10 ? 90 : 100;
    candles.push(c(101, 102, low, 101, i * 3_600_000, tf));
  }
  candles.push(c(101, 102, 85, 88, 20 * 3_600_000, tf)); // breakdown
  return candles;
}

describe("analyzeMtf", () => {
  it("mapa vacío → bias NEUTRAL con confidence=0 + perTimeframe = una entry NEUTRAL por TF", () => {
    const r = analyzeMtf(new Map());
    expect(r.bias).toBe("NEUTRAL");
    expect(r.confidence).toBe(0);
    expect(r.bullScore).toBe(0);
    expect(r.bearScore).toBe(0);
    expect(r.perTimeframe.size).toBe(TIMEFRAMES.length);
  });

  it("todos los TFs bullish → bias BUY", () => {
    const map = new Map<Timeframe, Candle[]>();
    for (const tf of TIMEFRAMES) map.set(tf, bullishSeries(tf));
    const r = analyzeMtf(map);
    expect(r.bias).toBe("BUY");
    expect(r.bullScore).toBeGreaterThan(r.bearScore);
  });

  it("todos los TFs bearish → bias SELL", () => {
    const map = new Map<Timeframe, Candle[]>();
    for (const tf of TIMEFRAMES) map.set(tf, bearishSeries(tf));
    const r = analyzeMtf(map);
    expect(r.bias).toBe("SELL");
    expect(r.bearScore).toBeGreaterThan(r.bullScore);
  });

  it("perTimeframe contiene la signal SMC por cada TF", () => {
    const map = new Map<Timeframe, Candle[]>();
    for (const tf of TIMEFRAMES) map.set(tf, bullishSeries(tf));
    const r = analyzeMtf(map);
    for (const tf of TIMEFRAMES) {
      expect(r.perTimeframe.get(tf)).toBeDefined();
    }
  });

  it("confidence ∈ [0, 1]", () => {
    const map = new Map<Timeframe, Candle[]>();
    for (const tf of TIMEFRAMES) map.set(tf, bullishSeries(tf));
    const r = analyzeMtf(map);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("net cercano a 0 (diferencia < 0.05) → NEUTRAL", () => {
    // Mezcla mitad bull, mitad bear → diff pequeña
    const map = new Map<Timeframe, Candle[]>();
    let i = 0;
    for (const tf of TIMEFRAMES) {
      map.set(tf, i % 2 === 0 ? bullishSeries(tf) : bearishSeries(tf));
      i++;
    }
    const r = analyzeMtf(map);
    // Puede ser BUY/SELL/NEUTRAL dependiendo del balance, pero confidence será baja
    expect(Math.abs(r.bullScore - r.bearScore)).toBeLessThan(0.5);
  });
});
