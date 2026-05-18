import { describe, expect, it } from "vitest";
import { detectSymbolTfFromBinanceFilename, parseBinanceCsv } from "./binance-csv-parser";

describe("detectSymbolTfFromBinanceFilename", () => {
  it("matches daily bulk-archive name", () => {
    expect(detectSymbolTfFromBinanceFilename("BTCUSDT-1m-2024-01-15.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "M1" });
    expect(detectSymbolTfFromBinanceFilename("ETHUSDT-15m-2024-01-15.csv"))
      .toEqual({ symbol: "ETHUSDT", tf: "M15" });
  });

  it("matches hourly + daily intervals", () => {
    expect(detectSymbolTfFromBinanceFilename("BTCUSDT-1h-2024-01-15.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "H1" });
    expect(detectSymbolTfFromBinanceFilename("BTCUSDT-4h-2024-01-15.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "H4" });
    expect(detectSymbolTfFromBinanceFilename("BTCUSDT-1d-2024-01-15.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "D1" });
  });

  it("matches monthly archive (no -DD suffix)", () => {
    expect(detectSymbolTfFromBinanceFilename("BTCUSDT-1h-2024-01.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "H1" });
  });

  it("returns null for non-Binance names", () => {
    expect(detectSymbolTfFromBinanceFilename("random.csv")).toBeNull();
    expect(detectSymbolTfFromBinanceFilename("XAUUSD_M15.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectSymbolTfFromBinanceFilename("/folder/BTCUSDT-1m-2024-01-15.csv"))
      .toEqual({ symbol: "BTCUSDT", tf: "M1" });
  });
});

describe("parseBinanceCsv", () => {
  it("parses standard 12-column klines without header", () => {
    const text = [
      "1704067200000,42000.00,42500.00,41800.00,42300.00,1234.56,1704067259999,52166000.0,5678,617.78,26083000.0,0",
      "1704067260000,42300.00,42600.00,42200.00,42400.00,890.12,1704067319999,37687000.0,4321,445.06,18843500.0,0",
    ].join("\n");
    const r = parseBinanceCsv(text);
    expect(r.bars).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.hasHeader).toBe(false);
    expect(r.bars[0].ts).toBe("2024-01-01T00:00:00.000Z");
    expect(r.bars[0].open).toBe(42000);
    expect(r.bars[0].volume).toBeCloseTo(1234.56, 2);
    expect(r.bars[0].spread).toBeNull();
  });

  it("accepts a header row (detected by non-numeric first cell)", () => {
    const text = [
      "open_time,open,high,low,close,volume,close_time,quote_volume,trades,taker_buy_base,taker_buy_quote,ignore",
      "1704067200000,42000,42500,41800,42300,1234.56,1704067259999,0,0,0,0,0",
    ].join("\n");
    const r = parseBinanceCsv(text);
    expect(r.hasHeader).toBe(true);
    expect(r.bars).toHaveLength(1);
  });

  it("rejects rows with bad open_time", () => {
    const text = [
      "1704067200000,42000,42500,41800,42300,100,1,1,1,1,1,0",  // valid
      "not-a-number,42000,42500,41800,42300,100,1,1,1,1,1,0",   // bad ts
    ].join("\n");
    const r = parseBinanceCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors[0].message).toContain("bad_open_time");
  });

  it("rejects rows with invalid OHLC", () => {
    const text = "1704067200000,42000,41000,41800,42300,100,1,1,1,1,1,0"; // high < low
    const r = parseBinanceCsv(text);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("strips leading BOM", () => {
    const text = "﻿1704067200000,42000,42500,41800,42300,100,1,1,1,1,1,0";
    const r = parseBinanceCsv(text);
    expect(r.bars).toHaveLength(1);
  });

  it("returns explicit error on empty input", () => {
    expect(parseBinanceCsv("").errors[0].message).toBe("empty_file");
  });
});
