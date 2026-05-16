import { describe, expect, it } from "vitest";
import { detectSymbolTfFromTradovateFilename, parseTradovateCsv } from "./tradovate-csv-parser";

describe("detectSymbolTfFromTradovateFilename", () => {
  it("matches Tradovate-style export names", () => {
    expect(detectSymbolTfFromTradovateFilename("ES_15Min.csv")).toEqual({ symbol: "ES", tf: "M15" });
    expect(detectSymbolTfFromTradovateFilename("NQ_5Min_2024.csv")).toEqual({ symbol: "NQ", tf: "M5" });
    expect(detectSymbolTfFromTradovateFilename("GC.1Min.csv")).toEqual({ symbol: "GC", tf: "M1" });
    expect(detectSymbolTfFromTradovateFilename("CL_Daily.csv")).toEqual({ symbol: "CL", tf: "D1" });
    expect(detectSymbolTfFromTradovateFilename("YM_240Min.csv")).toEqual({ symbol: "YM", tf: "H4" });
    expect(detectSymbolTfFromTradovateFilename("RTY_60Min.csv")).toEqual({ symbol: "RTY", tf: "H1" });
  });

  it("does not match 1Min inside 15Min (longest-first)", () => {
    // Without longest-first, "15Min" would match "1Min" greedily
    expect(detectSymbolTfFromTradovateFilename("ES_15Min.csv")?.tf).toBe("M15");
  });

  it("returns null when no match", () => {
    expect(detectSymbolTfFromTradovateFilename("random.csv")).toBeNull();
    expect(detectSymbolTfFromTradovateFilename("ES_unknown.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectSymbolTfFromTradovateFilename("/some/folder/ES_5Min.csv")).toEqual({ symbol: "ES", tf: "M5" });
    expect(detectSymbolTfFromTradovateFilename("C:\\tradovate\\NQ_Daily.csv")).toEqual({ symbol: "NQ", tf: "D1" });
  });
});

describe("parseTradovateCsv", () => {
  it("parses 8-column CSV with UpVolume + DownVolume (sum into volume)", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,UpVolume,DownVolume",
      "01/15/2024,09:30:00,4750.25,4751.50,4749.75,4750.50,1234,987",
      "01/15/2024,09:45:00,4750.50,4752.00,4750.25,4751.75,2100,500",
    ].join("\n");
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.hasHeader).toBe(true);
    expect(r.bars[0].volume).toBe(1234 + 987);
    expect(r.bars[1].volume).toBe(2100 + 500);
    expect(r.bars[0].spread).toBeNull();
    expect(r.bars[0].ts).toBe("2024-01-15T09:30:00.000Z");
  });

  it("parses 7-column CSV with combined volume", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "01/15/2024,09:30:00,100,101,99,100.5,3000",
    ].join("\n");
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].volume).toBe(3000);
  });

  it("accepts ISO date fallback (YYYY-MM-DD) alongside US MM/DD/YYYY", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "2024-01-15,09:30:00,100,101,99,100.5,3000",
    ].join("\n");
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].ts).toBe("2024-01-15T09:30:00.000Z");
  });

  it("applies tzOffsetMinutes (chart in EST = UTC-5 → add 300m to UTC)", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "01/15/2024,09:30:00,100,101,99,100.5,3000",
    ].join("\n");
    const r = parseTradovateCsv(text, { tzOffsetMinutes: -300 });
    // 09:30 EST → 14:30 UTC
    expect(r.bars[0].ts).toBe("2024-01-15T14:30:00.000Z");
  });

  it("rejects rows with invalid OHLC", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "01/15/2024,09:30:00,100,101,99,100.5,3000",   // valid
      "01/15/2024,09:45:00,100,95,99,100.5,3000",    // high < low and < open
    ].join("\n");
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("rejects rows with bad datetime format", () => {
    const text = [
      "Date,Time,Open,High,Low,Close,Volume",
      "not-a-date,09:30:00,100,101,99,100.5,3000",
    ].join("\n");
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("bad_datetime");
  });

  it("strips a leading BOM", () => {
    const text = "﻿Date,Time,Open,High,Low,Close,Volume\n01/15/2024,09:30:00,100,101,99,100.5,3000";
    const r = parseTradovateCsv(text);
    expect(r.bars).toHaveLength(1);
  });

  it("returns an explicit error on empty input", () => {
    expect(parseTradovateCsv("").errors[0].message).toBe("empty_file");
  });
});
