import { describe, expect, it } from "vitest";
import {
  resolveSymbol,
  getApiSourcesForTf,
  getCsvSourcesForTf,
  hasApiCoverage,
  nextStepsForEmpty,
  listRegisteredSymbols,
} from "./source-registry";

describe("resolveSymbol", () => {
  it("returns explicit entry for known symbols", () => {
    const xau = resolveSymbol("XAUUSD");
    expect(xau.assetClass).toBe("metals-spot");
    expect(xau.apiSources).toEqual([]);
    expect(xau.notes).toContain("XAUUSD=X");
  });

  it("normalizes case", () => {
    expect(resolveSymbol("eurusd").assetClass).toBe("forex");
    expect(resolveSymbol("XaUuSd").assetClass).toBe("metals-spot");
  });

  it("returns 'unknown' for unregistered symbols", () => {
    const r = resolveSymbol("UNKNOWN_PAIR_123");
    expect(r.assetClass).toBe("unknown");
    expect(r.apiSources).toEqual([]);
    expect(r.notes).toContain("no está en el registry");
  });

  it("registry covers every wizard-exposed symbol", () => {
    // Minimum coverage — keep in sync with NewStrategyWizard's exposed instruments.
    const required = [
      "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "US500", "BTCUSD",
      "ES", "NQ", "GC", "SPY", "QQQ",
    ];
    const known = new Set(listRegisteredSymbols());
    for (const s of required) {
      expect(known.has(s), `symbol ${s} missing from registry`).toBe(true);
    }
  });
});

describe("getApiSourcesForTf", () => {
  it("XAUUSD returns [] for any TF (Yahoo dead, no other API)", () => {
    expect(getApiSourcesForTf("XAUUSD", "M1")).toEqual([]);
    expect(getApiSourcesForTf("XAUUSD", "D1")).toEqual([]);
  });

  it("EURUSD returns yahoo for any TF it supports", () => {
    expect(getApiSourcesForTf("EURUSD", "M1")).toEqual(["yahoo"]);
    expect(getApiSourcesForTf("EURUSD", "D1")).toEqual(["yahoo"]);
  });

  it("ES (futures) returns yahoo", () => {
    expect(getApiSourcesForTf("ES", "M15")).toEqual(["yahoo"]);
  });

  it("unknown symbol returns [] (no auto-fetch)", () => {
    expect(getApiSourcesForTf("FOOBAR", "D1")).toEqual([]);
  });
});

describe("getCsvSourcesForTf", () => {
  it("XAUUSD lists mt5/mt4/dukascopy/histdata for M1", () => {
    expect(getCsvSourcesForTf("XAUUSD", "M1")).toEqual(["mt5", "mt4", "dukascopy", "histdata"]);
  });

  it("XAUUSD drops histdata for non-M1 (histdata is M1-only)", () => {
    const d1 = getCsvSourcesForTf("XAUUSD", "D1");
    expect(d1).not.toContain("histdata");
    expect(d1).toContain("mt5");
    expect(d1).toContain("dukascopy");
  });

  it("ES (futures) lists tradovate and cme for D1", () => {
    const d1 = getCsvSourcesForTf("ES", "D1");
    expect(d1).toContain("tradovate");
    expect(d1).toContain("cme");
  });

  it("ES drops cme for M15 (cme is D1-only)", () => {
    const m15 = getCsvSourcesForTf("ES", "M15");
    expect(m15).toContain("tradovate");
    expect(m15).not.toContain("cme");
  });

  it("SPY has no CSV sources (stock-equity, Yahoo only)", () => {
    expect(getCsvSourcesForTf("SPY", "D1")).toEqual([]);
  });
});

describe("hasApiCoverage", () => {
  it("returns true for symbols Yahoo supports", () => {
    expect(hasApiCoverage("EURUSD", "M1")).toBe(true);
    expect(hasApiCoverage("ES", "D1")).toBe(true);
    expect(hasApiCoverage("SPY", "M15")).toBe(true);
  });

  it("returns false for CSV-only symbols", () => {
    expect(hasApiCoverage("XAUUSD", "M1")).toBe(false);
    expect(hasApiCoverage("XAGUSD", "D1")).toBe(false);
  });
});

describe("nextStepsForEmpty", () => {
  it("XAUUSD: surfaces the Yahoo-dead note and CSV options", () => {
    const steps = nextStepsForEmpty("XAUUSD", "M1");
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.includes("404"))).toBe(true);
    expect(steps.some((s) => s.includes("mt5") || s.includes("dukascopy"))).toBe(true);
  });

  it("unknown symbol: suggests removing it", () => {
    const steps = nextStepsForEmpty("FOOBAR", "D1");
    expect(steps.some((s) => s.includes("eliminalo"))).toBe(true);
  });

  it("EURUSD: even with empty result, still offers CSV alternatives", () => {
    const steps = nextStepsForEmpty("EURUSD", "M1");
    expect(steps.some((s) => s.includes("mt5") || s.includes("dukascopy"))).toBe(true);
  });

  it("SPY: no CSV alternatives, no suggestion (Yahoo is the only path)", () => {
    const steps = nextStepsForEmpty("SPY", "D1");
    // SPY has yahoo-only with no csvSources, so no CSV suggestion appears
    expect(steps.some((s) => s.toLowerCase().includes("mt5"))).toBe(false);
  });
});
