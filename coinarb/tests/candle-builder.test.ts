import { describe, it, expect } from "vitest";
import {
  buildCandles,
  buildAllTimeframes,
  mergeWithRealtimeCandles,
  type Candle,
} from "../src/analysis/candle-builder.js";
import type { PriceSample } from "../src/feeds/coinbase-ws.js";
import type { Timeframe } from "../src/core/config.js";

function makeSample(timestamp: number, price: number): PriceSample {
  return { timestamp, price } as PriceSample;
}

function alignedNow(bucketMs: number): number {
  return Math.floor(Date.now() / bucketMs) * bucketMs;
}

describe("buildCandles", () => {
  it("samples vacíos → []", () => {
    expect(buildCandles([], "1M")).toEqual([]);
  });

  it("samples dentro del bucket actual NO se publican (sólo closed candles)", () => {
    // Todos los samples en el bucket actual → ningún bucket previo con datos
    const now = Date.now();
    const samples = [makeSample(now, 100), makeSample(now + 100, 101)];
    expect(buildCandles(samples, "1M")).toEqual([]);
  });

  it("construye 1 candle 1M con OHLC correcto", () => {
    const bucketMs = 60_000;
    // Bucket cerrado: 2 minutos atrás
    const closedBucket = alignedNow(bucketMs) - 2 * bucketMs;
    const samples = [
      makeSample(closedBucket + 1000, 100), // open
      makeSample(closedBucket + 10_000, 110), // high
      makeSample(closedBucket + 20_000, 95), // low
      makeSample(closedBucket + 50_000, 105), // close
    ];
    const candles = buildCandles(samples, "1M", 10);
    expect(candles).toHaveLength(1);
    const c = candles[0];
    expect(c.open).toBe(100);
    expect(c.high).toBe(110);
    expect(c.low).toBe(95);
    expect(c.close).toBe(105);
    expect(c.volume).toBe(0);
    expect(c.timeframe).toBe("1M");
    expect(c.openTs).toBe(closedBucket);
    expect(c.closeTs).toBe(closedBucket + bucketMs);
  });

  it("skipea buckets vacíos pero publica los que tienen samples antes del current", () => {
    const bucketMs = 60_000;
    const t = alignedNow(bucketMs);
    // Samples en bucket(-3) y bucket(-1), nada en (-2)
    const samples = [
      makeSample(t - 3 * bucketMs + 100, 100),
      makeSample(t - 1 * bucketMs + 100, 105),
    ];
    const candles = buildCandles(samples, "1M");
    // El loop itera buckets < current: -3, -2, -1. (-2) se skipea por vacío.
    // → 2 candles publicados
    expect(candles).toHaveLength(2);
    expect(candles[0].open).toBe(100);
    expect(candles[1].open).toBe(105);
  });

  it("respeta maxCandles", () => {
    const bucketMs = 60_000;
    const t = alignedNow(bucketMs);
    // 10 buckets cerrados con 1 sample cada uno
    const samples: PriceSample[] = [];
    for (let i = 10; i >= 2; i--) {
      samples.push(makeSample(t - i * bucketMs + 1000, 100 + i));
    }
    const candles = buildCandles(samples, "1M", 3);
    expect(candles).toHaveLength(3);
  });

  it("OHLC con un solo sample → open=high=low=close", () => {
    const bucketMs = 60_000;
    const t = alignedNow(bucketMs) - 2 * bucketMs;
    const candles = buildCandles([makeSample(t + 1000, 42)], "1M");
    expect(candles[0].open).toBe(42);
    expect(candles[0].high).toBe(42);
    expect(candles[0].low).toBe(42);
    expect(candles[0].close).toBe(42);
  });
});

describe("buildAllTimeframes", () => {
  it("retorna mapa con un Candle[] por timeframe solicitado", () => {
    const tfs: Timeframe[] = ["1M", "5M", "15M"];
    const r = buildAllTimeframes([], tfs);
    expect(r.size).toBe(3);
    for (const tf of tfs) {
      expect(r.get(tf)).toEqual([]);
    }
  });
});

describe("mergeWithRealtimeCandles", () => {
  function c(tf: Timeframe, openTs: number, close: number, volume = 0): Candle {
    return {
      timeframe: tf, openTs, closeTs: openTs + 60_000,
      open: close, high: close, low: close, close, volume,
    };
  }

  it("realtime tiene prioridad sobre histórico para mismos timestamps", () => {
    const hist = new Map<Timeframe, Candle[]>([
      ["1M", [c("1M", 1000, 100), c("1M", 2000, 110), c("1M", 3000, 120)]],
    ]);
    const rt = new Map<Timeframe, Candle[]>([
      ["1M", [c("1M", 2000, 999), c("1M", 3000, 998)]], // sobrescribe 2000, 3000
    ]);
    const merged = mergeWithRealtimeCandles(hist, rt);
    const r = merged.get("1M")!;
    expect(r).toHaveLength(3);
    expect(r[0].openTs).toBe(1000);
    expect(r[1].close).toBe(999);
    expect(r[2].close).toBe(998);
  });

  it("TF solo en realtime → se preserva", () => {
    const hist = new Map<Timeframe, Candle[]>([["1M", [c("1M", 1000, 100)]]]);
    const rt = new Map<Timeframe, Candle[]>([["5M", [c("5M", 1000, 200)]]]);
    const merged = mergeWithRealtimeCandles(hist, rt);
    expect(merged.has("1M")).toBe(true);
    expect(merged.has("5M")).toBe(true);
    expect(merged.get("5M")![0].close).toBe(200);
  });

  it("realtime vacío para un TF → usa solo histórico", () => {
    const hist = new Map<Timeframe, Candle[]>([["1M", [c("1M", 1000, 100)]]]);
    const rt = new Map<Timeframe, Candle[]>([["1M", []]]);
    const merged = mergeWithRealtimeCandles(hist, rt);
    expect(merged.get("1M")).toHaveLength(1);
    expect(merged.get("1M")![0].close).toBe(100);
  });

  it("cap de 200 candles después del merge", () => {
    const histList = Array.from({ length: 300 }, (_, i) => c("1M", i * 60_000, 100 + i));
    const merged = mergeWithRealtimeCandles(
      new Map([["1M", histList]]),
      new Map([["1M", [c("1M", 999_999_000, 999)]]]),
    );
    expect(merged.get("1M")!.length).toBeLessThanOrEqual(200);
  });
});
