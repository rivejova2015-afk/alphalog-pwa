import { describe, expect, it } from "vitest";
import { detectSymbolTfFromHistDataFilename, parseHistDataCsv } from "./histdata-csv-parser";

describe("detectSymbolTfFromHistDataFilename", () => {
  it("matches monthly export", () => {
    expect(detectSymbolTfFromHistDataFilename("DAT_ASCII_EURUSD_M1_202401.csv"))
      .toEqual({ symbol: "EURUSD", tf: "M1" });
  });

  it("matches yearly export", () => {
    expect(detectSymbolTfFromHistDataFilename("DAT_ASCII_XAUUSD_M1_2024.csv"))
      .toEqual({ symbol: "XAUUSD", tf: "M1" });
  });

  it("returns null for non-HistData names", () => {
    expect(detectSymbolTfFromHistDataFilename("EURUSD_M1.csv")).toBeNull();
    expect(detectSymbolTfFromHistDataFilename("random.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectSymbolTfFromHistDataFilename("/folder/DAT_ASCII_EURUSD_M1_202401.csv"))
      .toEqual({ symbol: "EURUSD", tf: "M1" });
  });
});

describe("parseHistDataCsv", () => {
  it("parses standard HistData Generic ASCII (default EST = UTC-5)", () => {
    const text = [
      "20240115 003000;1.10000;1.10010;1.09990;1.10005;0",
      "20240115 003100;1.10005;1.10020;1.09995;1.10015;0",
    ].join("\n");
    const r = parseHistDataCsv(text);
    expect(r.bars).toHaveLength(2);
    expect(r.errors).toHaveLength(0);
    expect(r.hasHeader).toBe(false);
    expect(r.delimiter).toBe(";");
    // 00:30 EST → 05:30 UTC
    expect(r.bars[0].ts).toBe("2024-01-15T05:30:00.000Z");
    expect(r.bars[0].volume).toBe(0);
    expect(r.bars[0].spread).toBeNull();
  });

  it("honors tzOffsetMinutes override (export was UTC)", () => {
    const text = "20240115 003000;1.10000;1.10010;1.09990;1.10005;0";
    const r = parseHistDataCsv(text, { tzOffsetMinutes: 0 });
    expect(r.bars[0].ts).toBe("2024-01-15T00:30:00.000Z");
  });

  it("rejects rows with invalid OHLC", () => {
    const text = [
      "20240115 003000;1.10000;1.10010;1.09990;1.10005;0",
      "20240115 003100;1.10000;1.09900;1.09995;1.10005;0",  // high < low
    ].join("\n");
    const r = parseHistDataCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("rejects bad datetime (wrong digit count)", () => {
    // Datetime is missing digits — doesn't match \d{4}\d{2}\d{2}\s\d{2}\d{2}\d{2}
    const text = [
      "2024115 003000;1;2;0.5;1.5;0",       // YYYYMMDD missing one digit, but starts with 2
      "20240115 003100;1;2;0.5;1.5;0",      // valid
    ].join("\n");
    const r = parseHistDataCsv(text);
    expect(r.bars).toHaveLength(1);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].message).toContain("bad_datetime");
  });

  it("strips leading BOM", () => {
    const text = "﻿20240115 003000;1.10000;1.10010;1.09990;1.10005;0";
    const r = parseHistDataCsv(text);
    expect(r.bars).toHaveLength(1);
  });

  it("returns explicit error on empty input", () => {
    expect(parseHistDataCsv("").errors[0].message).toBe("empty_file");
  });
});
