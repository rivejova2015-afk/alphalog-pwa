import { describe, expect, it } from "vitest";
import { detectSymbolTfFromDukascopyFilename, parseDukascopyCsv } from "./dukascopy-csv-parser";

describe("detectSymbolTfFromDukascopyFilename", () => {
  it("matches official Dukascopy export naming with Candlestick_N_U_BID", () => {
    expect(detectSymbolTfFromDukascopyFilename("EURUSD_Candlestick_1_M_BID_01.01.2024-31.01.2024.csv"))
      .toEqual({ symbol: "EURUSD", tf: "M1" });
    expect(detectSymbolTfFromDukascopyFilename("XAUUSD_Candlestick_15_M_BID_01.01.2024-31.01.2024.csv"))
      .toEqual({ symbol: "XAUUSD", tf: "M15" });
    expect(detectSymbolTfFromDukascopyFilename("GBPJPY_Candlestick_1_H_BID_01.01.2024-31.01.2024.csv"))
      .toEqual({ symbol: "GBPJPY", tf: "H1" });
    expect(detectSymbolTfFromDukascopyFilename("EURUSD_Candlestick_1_D_BID.csv"))
      .toEqual({ symbol: "EURUSD", tf: "D1" });
  });

  it("matches simpler MT-style renamed filenames", () => {
    expect(detectSymbolTfFromDukascopyFilename("EURUSD_M15.csv"))
      .toEqual({ symbol: "EURUSD", tf: "M15" });
    expect(detectSymbolTfFromDukascopyFilename("XAUUSD_H1.csv"))
      .toEqual({ symbol: "XAUUSD", tf: "H1" });
  });

  it("returns null when no match", () => {
    expect(detectSymbolTfFromDukascopyFilename("random.csv")).toBeNull();
    expect(detectSymbolTfFromDukascopyFilename("EURUSD_unknown.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectSymbolTfFromDukascopyFilename("/folder/EURUSD_Candlestick_1_M_BID.csv"))
      .toEqual({ symbol: "EURUSD", tf: "M1" });
  });
});

describe("parseDukascopyCsv", () => {
  it("parses standard Dukascopy export with embedded GMT+0000", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "01.01.2024 00:00:00.000 GMT+0000,1.10000,1.10010,1.09990,1.10005,123.45",
      "01.01.2024 00:01:00.000 GMT+0000,1.10005,1.10020,1.09995,1.10015,98.12",
    ].join("\n");
    const r = parseDukascopyCsv(text);
    expect(r.bars).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.hasHeader).toBe(true);
    expect(r.bars[0].ts).toBe("2024-01-01T00:00:00.000Z");
    expect(r.bars[0].volume).toBeCloseTo(123.45, 2);
    expect(r.bars[0].spread).toBeNull();
  });

  it("honors embedded GMT-0500 offset (NY chart export)", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "15.01.2024 09:30:00.000 GMT-0500,4750.25,4751.50,4749.75,4750.50,1234.5",
    ].join("\n");
    const r = parseDukascopyCsv(text);
    // 09:30 EST = 14:30 UTC
    expect(r.bars[0].ts).toBe("2024-01-15T14:30:00.000Z");
  });

  it("falls back to user tzOffsetMinutes when no embedded GMT tag", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "15.01.2024 09:30:00.000,100,101,99,100.5,1000",
    ].join("\n");
    const r = parseDukascopyCsv(text, { tzOffsetMinutes: -300 });
    // 09:30 user-said-EST → 14:30 UTC
    expect(r.bars[0].ts).toBe("2024-01-15T14:30:00.000Z");
  });

  it("rejects rows with invalid OHLC", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "01.01.2024 00:00:00.000 GMT+0000,100,101,99,100.5,1000", // valid
      "01.01.2024 00:01:00.000 GMT+0000,100,95,99,100.5,1000",  // high < low
    ].join("\n");
    const r = parseDukascopyCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("rejects rows with bad datetime format", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "not-a-date,100,101,99,100.5,1000",
    ].join("\n");
    const r = parseDukascopyCsv(text);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("bad_datetime");
  });

  it("strips leading BOM", () => {
    const text = "﻿Local time,Open,High,Low,Close,Volume\n01.01.2024 00:00:00.000 GMT+0000,1,2,0.5,1.5,10";
    const r = parseDukascopyCsv(text);
    expect(r.bars).toHaveLength(1);
  });

  it("handles missing milliseconds", () => {
    const text = [
      "Local time,Open,High,Low,Close,Volume",
      "01.01.2024 00:00:00 GMT+0000,1,2,0.5,1.5,10",
    ].join("\n");
    const r = parseDukascopyCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].ts).toBe("2024-01-01T00:00:00.000Z");
  });

  it("returns explicit error on empty input", () => {
    expect(parseDukascopyCsv("").errors[0].message).toBe("empty_file");
  });
});
