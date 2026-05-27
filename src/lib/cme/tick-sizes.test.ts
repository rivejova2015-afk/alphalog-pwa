import { describe, expect, it } from "vitest";
import { tickSizeFor, rootSymbolOf } from "./tick-sizes";

describe("tickSizeFor", () => {
  it("returns CME-spec tick size for equity indices", () => {
    expect(tickSizeFor("ES")).toBe(0.25);
    expect(tickSizeFor("NQ")).toBe(0.25);
    expect(tickSizeFor("RTY")).toBe(0.10);
  });

  it("returns tick size for metals", () => {
    expect(tickSizeFor("GC")).toBe(0.10);
    expect(tickSizeFor("SI")).toBe(0.005);
    expect(tickSizeFor("HG")).toBe(0.0005);
  });

  it("returns tick size for energy", () => {
    expect(tickSizeFor("CL")).toBe(0.01);
    expect(tickSizeFor("NG")).toBe(0.001);
  });

  it("returns null for unknown contracts (caller falls back to defaults)", () => {
    expect(tickSizeFor("XAUUSD")).toBeNull();     // spot, not futures
    expect(tickSizeFor("UNKNOWN")).toBeNull();
    expect(tickSizeFor("")).toBeNull();
  });

  it("normalizes case", () => {
    expect(tickSizeFor("es")).toBe(0.25);
    expect(tickSizeFor("Es")).toBe(0.25);
  });
});

describe("rootSymbolOf", () => {
  it("strips standard single-letter-month + single-digit-year suffix", () => {
    expect(rootSymbolOf("ESH4")).toBe("ES");
    expect(rootSymbolOf("GCM5")).toBe("GC");
    expect(rootSymbolOf("NQZ4")).toBe("NQ");
    expect(rootSymbolOf("CLU5")).toBe("CL");
  });

  it("handles micro contracts", () => {
    expect(rootSymbolOf("MESH4")).toBe("MES");
    expect(rootSymbolOf("MNQM5")).toBe("MNQ");
  });

  it("handles FX futures with digit prefix", () => {
    expect(rootSymbolOf("6EH4")).toBe("6E");
    expect(rootSymbolOf("6BU5")).toBe("6B");
  });

  it("returns unchanged when no expiry suffix", () => {
    expect(rootSymbolOf("ES")).toBe("ES");
    expect(rootSymbolOf("GC")).toBe("GC");
  });

  it("normalizes case + trims", () => {
    expect(rootSymbolOf("  esh4  ")).toBe("ES");
    expect(rootSymbolOf("esh4")).toBe("ES");
  });

  it("does NOT strip suffix when last char is not a digit", () => {
    expect(rootSymbolOf("ESPX")).toBe("ESPX");
  });
});
