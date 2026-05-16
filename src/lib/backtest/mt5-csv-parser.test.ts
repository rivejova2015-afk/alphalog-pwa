import { describe, expect, it } from "vitest";
import { detectSymbolTfFromFilename, parseMt5Csv } from "./mt5-csv-parser";

describe("detectSymbolTfFromFilename", () => {
  it("matches default MT5 export name", () => {
    expect(detectSymbolTfFromFilename("XAUUSD_M15.csv")).toEqual({ symbol: "XAUUSD", tf: "M15" });
    expect(detectSymbolTfFromFilename("EURUSD_H1_2024.csv")).toEqual({ symbol: "EURUSD", tf: "H1" });
    expect(detectSymbolTfFromFilename("US500.D1.csv")).toEqual({ symbol: "US500", tf: "D1" });
  });

  it("returns null when no match", () => {
    expect(detectSymbolTfFromFilename("random.csv")).toBeNull();
    expect(detectSymbolTfFromFilename("XAUUSD_unknown.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectSymbolTfFromFilename("/some/folder/XAUUSD_M5.csv")).toEqual({ symbol: "XAUUSD", tf: "M5" });
    expect(detectSymbolTfFromFilename("C:\\mt5\\XAUUSD_D1.csv")).toEqual({ symbol: "XAUUSD", tf: "D1" });
  });
});

describe("parseMt5Csv", () => {
  it("parses an 8-column CSV with header (Date, Time, OHLC, Volume, Spread)", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume,Spread",
      "2024.01.15,00:00,2030.45,2031.20,2029.10,2030.85,123,15",
      "2024.01.15,00:15,2030.85,2032.00,2030.50,2031.75,89,12",
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.bars).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.hasHeader).toBe(true);
    expect(r.hasSpread).toBe(true);
    expect(r.bars[0].spread).toBe(15);
    expect(r.bars[0].ts).toBe("2024-01-15T00:00:00.000Z");
  });

  it("parses a 7-column CSV without spread", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "2024.01.15,00:00,2030.45,2031.20,2029.10,2030.85,123",
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.hasSpread).toBe(false);
    expect(r.bars[0].spread).toBeNull();
  });

  it("applies tzOffsetMinutes (broker GMT+2 → subtract 120m to UTC)", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "2024.01.15,02:00,1.0900,1.0905,1.0895,1.0901,1000",
    ].join("\n");
    const r = parseMt5Csv(text, { tzOffsetMinutes: 120 });
    // 02:00 broker time @ GMT+2 → 00:00 UTC
    expect(r.bars[0].ts).toBe("2024-01-15T00:00:00.000Z");
  });

  it("sniffs ';' delimiter", () => {
    const text = [
      "Date;Time;Open;High;Low;Close;Volume",
      "2024.01.15;00:00;100;101;99;100.5;50",
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.delimiter).toBe(";");
    expect(r.bars).toHaveLength(1);
  });

  it("strips a leading BOM", () => {
    const text = "﻿Date,Time,Open,High,Low,Close,Volume\n2024.01.15,00:00,1,2,0.5,1.5,10";
    const r = parseMt5Csv(text);
    expect(r.bars).toHaveLength(1);
  });

  it("rejects rows with invalid OHLC", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "2024.01.15,00:00,2030,2031,2029,2030.5,100",   // valid
      "2024.01.15,00:15,2030,2025,2029,2030.5,100",   // high < low and < open
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("rejects rows with bad datetime format", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "not-a-date,00:00,1,2,0,1.5,10",
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("bad_datetime");
  });

  it("returns an explicit error on empty input", () => {
    expect(parseMt5Csv("").errors[0].message).toBe("empty_file");
  });

  it("handles seconds in time (HH:MM:SS)", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "2024.01.15,00:00:30,1,2,0.5,1.5,10",
    ].join("\n");
    const r = parseMt5Csv(text);
    expect(r.bars[0].ts).toBe("2024-01-15T00:00:30.000Z");
  });
});
