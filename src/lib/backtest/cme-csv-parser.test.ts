import { describe, expect, it } from "vitest";
import { detectTfFromCmeFilename, parseCmeCsv } from "./cme-csv-parser";

describe("detectTfFromCmeFilename", () => {
  it("matches official daily settlement name", () => {
    expect(detectTfFromCmeFilename("settle.20240115.s.csv")).toEqual({ tf: "D1" });
    expect(detectTfFromCmeFilename("settle.20240202.s.csv")).toEqual({ tf: "D1" });
  });

  it("returns null for non-CME names", () => {
    expect(detectTfFromCmeFilename("random.csv")).toBeNull();
    expect(detectTfFromCmeFilename("settle.csv")).toBeNull();
    expect(detectTfFromCmeFilename("EURUSD_M1.csv")).toBeNull();
  });

  it("strips path", () => {
    expect(detectTfFromCmeFilename("/cme/settle.20240115.s.csv")).toEqual({ tf: "D1" });
  });
});

describe("parseCmeCsv", () => {
  const SAMPLE = [
    "BizDt,Sym,ID,StrkPx,SecTyp,MMY,OpnT,HghT,LwT,Vol,OpInt,Settle,SubProductSymbol",
    "2024-01-15,ESH4,1,,FUT,202403,4748.00,4755.50,4745.75,1234567,2345678,4750.50,ES",
    "2024-01-15,NQH4,2,,FUT,202403,16500.00,16550.00,16480.00,890123,567890,16525.50,NQ",
    "2024-01-15,GCG4,3,,FUT,202402,2030.00,2035.00,2028.00,123456,234567,2032.50,GC",
    "2024-01-15,ESH4P4750,4,4750,OPT,202403,2.50,3.10,2.30,500,1000,2.85,ES",  // option — should skip
  ].join("\n");

  it("parses all FUT rows, skips OPT", () => {
    const r = parseCmeCsv(SAMPLE);
    expect(r.bars).toHaveLength(3);  // ES, NQ, GC — not the option
    expect(r.errors).toHaveLength(0);
    expect(r.contractsSeen).toEqual(["ES", "GC", "NQ"]);
  });

  it("uses Settle as close (not Last)", () => {
    const r = parseCmeCsv(SAMPLE);
    const es = r.bars.find((b) => b.ts.startsWith("2024-01-15"));
    expect(es?.close).toBe(4750.50);  // Settle value, not OpnT/HghT/LwT
  });

  it("filters by SubProductSymbol", () => {
    const r = parseCmeCsv(SAMPLE, { filterSymbol: "ES" });
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].open).toBe(4748);
  });

  it("filterSymbol is case-insensitive", () => {
    const r = parseCmeCsv(SAMPLE, { filterSymbol: "es" });
    expect(r.bars).toHaveLength(1);
  });

  it("reports contractsSeen even when filtered out", () => {
    const r = parseCmeCsv(SAMPLE, { filterSymbol: "RTY" });  // not in file
    expect(r.bars).toHaveLength(0);
    expect(r.contractsSeen).toEqual(["ES", "GC", "NQ"]);  // still recorded
  });

  it("rejects rows with invalid OHLC", () => {
    const bad = [
      "BizDt,Sym,ID,StrkPx,SecTyp,MMY,OpnT,HghT,LwT,Vol,OpInt,Settle,SubProductSymbol",
      "2024-01-15,ESH4,1,,FUT,202403,4748,4730,4745,1000,2000,4740,ES",   // high < low
    ].join("\n");
    const r = parseCmeCsv(bad);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("invalid_ohlc");
  });

  it("returns explicit error on empty input", () => {
    expect(parseCmeCsv("").errors[0].message).toBe("empty_file");
  });

  it("errors when required headers missing", () => {
    const noHeaders = "foo,bar,baz\n1,2,3";
    const r = parseCmeCsv(noHeaders);
    expect(r.bars).toHaveLength(0);
    expect(r.errors[0].message).toContain("missing_required_headers");
  });

  it("strips BOM", () => {
    const r = parseCmeCsv("﻿" + SAMPLE);
    expect(r.bars.length).toBeGreaterThan(0);
  });

  it("accepts alternative header names (BusinessDate, Open, High, etc.)", () => {
    const alt = [
      "BusinessDate,Symbol,SecurityType,Open,High,Low,SettlePrice,Volume,Product",
      "2024-01-15,ESH4,FUT,4748,4755.5,4745.75,4750.5,1234567,ES",
    ].join("\n");
    const r = parseCmeCsv(alt);
    expect(r.bars).toHaveLength(1);
    expect(r.bars[0].close).toBe(4750.5);
  });
});
