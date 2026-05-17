import { describe, expect, it } from "vitest";
import { mapToFxratesapiPair, fetchFxratesapiBars, __testing } from "./fxratesapi-fetcher";

describe("mapToFxratesapiPair", () => {
  it("maps XAUUSD -> XAU/USD", () => {
    expect(mapToFxratesapiPair("XAUUSD")).toEqual({ base: "XAU", quote: "USD" });
  });

  it("maps XAGUSD -> XAG/USD", () => {
    expect(mapToFxratesapiPair("XAGUSD")).toEqual({ base: "XAG", quote: "USD" });
  });

  it("maps XPTUSD and XPDUSD", () => {
    expect(mapToFxratesapiPair("XPTUSD")).toEqual({ base: "XPT", quote: "USD" });
    expect(mapToFxratesapiPair("XPDUSD")).toEqual({ base: "XPD", quote: "USD" });
  });

  it("normalizes case", () => {
    expect(mapToFxratesapiPair("xauusd")).toEqual({ base: "XAU", quote: "USD" });
  });

  it("returns null for non-metals symbols", () => {
    expect(mapToFxratesapiPair("EURUSD")).toBeNull();
    expect(mapToFxratesapiPair("ES")).toBeNull();
    expect(mapToFxratesapiPair("FOOBAR")).toBeNull();
  });
});

describe("fetchFxratesapiBars validation", () => {
  it("throws on non-D1 timeframe", async () => {
    await expect(fetchFxratesapiBars("XAUUSD", "M1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/only supports D1/);
    await expect(fetchFxratesapiBars("XAUUSD", "H1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/only supports D1/);
  });

  it("throws on unsupported symbol", async () => {
    await expect(fetchFxratesapiBars("EURUSD", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/No fxratesapi mapping/);
  });
});

describe("planChunks (366-day cap handling)", () => {
  const { planChunks } = __testing;

  it("single chunk when range <= 365 days", () => {
    const chunks = planChunks("2026-01-01T00:00:00Z", "2026-06-01T00:00:00Z");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start).toBe("2026-01-01");
    expect(chunks[0].end).toBe("2026-06-01");
  });

  it("two chunks when range > 365 days", () => {
    // 400 days requires splitting
    const chunks = planChunks("2025-01-01T00:00:00Z", "2026-02-05T00:00:00Z");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // First chunk should not exceed 365 days
    const firstSpan = (new Date(chunks[0].end).getTime() - new Date(chunks[0].start).getTime()) / 86_400_000;
    expect(firstSpan).toBeLessThanOrEqual(365);
    // Last chunk's end should match the requested end
    expect(chunks[chunks.length - 1].end).toBe("2026-02-05");
  });

  it("chunks are contiguous (no gaps)", () => {
    const chunks = planChunks("2024-01-01T00:00:00Z", "2026-05-01T00:00:00Z");
    for (let i = 1; i < chunks.length; i++) {
      // Next chunk should start within 1 day of previous chunk's end
      const prevEnd = new Date(chunks[i - 1].end).getTime();
      const thisStart = new Date(chunks[i].start).getTime();
      expect(thisStart - prevEnd).toBeLessThanOrEqual(86_400_000);
    }
  });
});

describe("ratesToBars (OHLC synthesis)", () => {
  const { ratesToBars } = __testing;

  it("synthesizes degenerate OHLC from single-price entries", () => {
    const rates = {
      "2026-05-14T23:59:00.000Z": { USD: 4649.28 },
      "2026-05-13T23:59:00.000Z": { USD: 4695.21 },
    };
    const bars = ratesToBars(rates, "USD");
    expect(bars).toHaveLength(2);
    // First bar by sort order = older date
    expect(bars[0].ts).toBe("2026-05-13T00:00:00.000Z");
    expect(bars[0].open).toBe(4695.21);
    expect(bars[0].high).toBe(4695.21);
    expect(bars[0].low).toBe(4695.21);
    expect(bars[0].close).toBe(4695.21);
    expect(bars[0].volume).toBe(0);
    expect(bars[0].spread).toBeNull();
  });

  it("normalizes timestamps to midnight UTC of the same calendar date", () => {
    const rates = { "2026-05-14T23:59:00.000Z": { USD: 4649.28 } };
    const bars = ratesToBars(rates, "USD");
    expect(bars[0].ts).toBe("2026-05-14T00:00:00.000Z");
  });

  it("skips invalid/non-numeric prices", () => {
    const rates = {
      "2026-05-14T23:59:00.000Z": { USD: 4649.28 },
      "2026-05-13T23:59:00.000Z": { USD: NaN },
      "2026-05-12T23:59:00.000Z": { USD: 4716.46 },
    } as Record<string, Record<string, number>>;
    const bars = ratesToBars(rates, "USD");
    expect(bars).toHaveLength(2);
    expect(bars.find((b) => b.ts.startsWith("2026-05-13"))).toBeUndefined();
  });

  it("dedups same-timestamp entries (chunk boundary overlap)", () => {
    const rates = {
      "2026-05-14T23:59:00.000Z": { USD: 4649.28 },
      "2026-05-14T00:00:00.000Z": { USD: 4650.00 },  // would normalize to same ts as above
    };
    const bars = ratesToBars(rates, "USD");
    expect(bars).toHaveLength(1);
  });
});
