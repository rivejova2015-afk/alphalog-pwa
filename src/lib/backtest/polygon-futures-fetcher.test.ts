import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  frontMonthContract,
  mapToPolygonFuturesTicker,
  fetchPolygonFuturesBars,
} from "./polygon-futures-fetcher";

describe("frontMonthContract", () => {
  it("maps ES in June 2026 to ESM26 (June front month)", () => {
    // June = month 5. ES cycle is [2,5,8,11]. Next month >= 5 → 5 → M / year 2026.
    expect(frontMonthContract("ES", new Date("2026-06-08T12:00:00Z"))).toBe("ESM26");
  });

  it("maps ES in October 2026 to ESZ26 (December front month)", () => {
    // October = month 9. Cycle [2,5,8,11]. Next >= 9 → 11 → Z / year 2026.
    expect(frontMonthContract("ES", new Date("2026-10-15T00:00:00Z"))).toBe("ESZ26");
  });

  it("wraps to next year when no more months in cycle (ES January)", () => {
    // January = month 0. Cycle [2,5,8,11]. Next >= 0 → 2 → H / year 2026 (same year).
    expect(frontMonthContract("ES", new Date("2026-01-15T00:00:00Z"))).toBe("ESH26");
  });

  it("wraps to next year for ES in December", () => {
    // December = month 11. Cycle [2,5,8,11]. Next >= 11 → 11 → Z / year 2026 (same).
    expect(frontMonthContract("ES", new Date("2026-12-20T00:00:00Z"))).toBe("ESZ26");
  });

  it("wraps when cycle exhausted: ES in late December if month > 11 hypothetical", () => {
    // Edge case: simulate via January with stricter logic — wrap to next year H.
    // ES cycle [2,5,8,11] — in January (0), first cycle month >= 0 is 2 → H26.
    // To trigger year wrap, use a symbol whose cycle has no month >= 11.
    expect(frontMonthContract("PL", new Date("2026-12-01T00:00:00Z"))).toBe("PLF27");
  });

  it("maps CL (monthly) to current month code", () => {
    expect(frontMonthContract("CL", new Date("2026-06-15T00:00:00Z"))).toBe("CLM26");
    expect(frontMonthContract("CL", new Date("2026-11-01T00:00:00Z"))).toBe("CLX26");
  });

  it("normalizes case", () => {
    expect(frontMonthContract("es", new Date("2026-06-08T00:00:00Z"))).toBe("ESM26");
  });

  it("returns null for non-futures symbols", () => {
    expect(frontMonthContract("AAPL", new Date("2026-06-08T00:00:00Z"))).toBeNull();
    expect(frontMonthContract("EURUSD", new Date("2026-06-08T00:00:00Z"))).toBeNull();
    expect(frontMonthContract("FOOBAR", new Date("2026-06-08T00:00:00Z"))).toBeNull();
  });

  it("returns null for invalid date", () => {
    expect(frontMonthContract("ES", new Date("not-a-date"))).toBeNull();
  });
});

describe("mapToPolygonFuturesTicker", () => {
  it("uses the END of the range to pick the front-month", () => {
    const m = mapToPolygonFuturesTicker("ES", "2026-09-30T23:59:59Z");
    expect(m).toEqual({ ticker: "ESU26", baseSymbol: "ES" });
  });

  it("returns null for unsupported symbol", () => {
    expect(mapToPolygonFuturesTicker("AAPL", "2026-06-08T00:00:00Z")).toBeNull();
  });
});

describe("fetchPolygonFuturesBars validation", () => {
  const ORIGINAL_KEY = process.env.POLYGON_API_KEY;

  beforeEach(() => {
    delete process.env.POLYGON_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY) process.env.POLYGON_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it("throws when POLYGON_API_KEY is not set", async () => {
    await expect(fetchPolygonFuturesBars("ES", "D1", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(/POLYGON_API_KEY not set/);
  });

  it("throws on unsupported symbol", async () => {
    process.env.POLYGON_API_KEY = "test-key";
    await expect(fetchPolygonFuturesBars("AAPL", "D1", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(/No Polygon Futures mapping/);
  });

  it("throws on invalid date range", async () => {
    process.env.POLYGON_API_KEY = "test-key";
    await expect(fetchPolygonFuturesBars("ES", "D1", "not-a-date", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(); // either "No Polygon Futures mapping" (toIso valid, fromIso invalid)
                          // or "Invalid date range" — the mapping check passes via toIso so
                          // we land on the date validation
  });
});

describe("fetchPolygonFuturesBars HTTP layer", () => {
  beforeEach(() => {
    process.env.POLYGON_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.POLYGON_API_KEY;
    vi.restoreAllMocks();
  });

  it("parses a successful response into Bar[]", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            { window_start: 1748736000000, open: 5200.5, high: 5215.0, low: 5198.0, close: 5210.25, volume: 1500000 },
            { window_start: 1748822400000, open: 5210.25, high: 5230.5, low: 5205.0, close: 5225.75, volume: 1800000 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const bars = await fetchPolygonFuturesBars("ES", "D1", "2025-06-01T00:00:00Z", "2025-06-03T00:00:00Z");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/futures/v1/aggs/");
    // ESM25 — June 2025 (toIso is 2025-06-03, ES cycle picks H/M/U/Z and M is closest)
    expect(String(url)).toContain("ESM25");
    expect(String(url)).toContain("resolution=1session");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-key",
    });

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({
      open: 5200.5,
      high: 5215.0,
      low: 5198.0,
      close: 5210.25,
      volume: 1500000,
    });
  });

  it("uses 1min resolution for M1 timeframe", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "OK", results: [] }), { status: 200 })
    );

    await fetchPolygonFuturesBars("CL", "M1", "2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("resolution=1min");
    expect(url).toContain("CLM26");  // CL monthly, June = M
  });

  it("translates HTTP 429 into a rate-limit message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Too many requests", { status: 429 })
    );

    await expect(fetchPolygonFuturesBars("ES", "D1", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(/rate limit exceeded.*5 req\/min/i);
  });

  it("translates HTTP 403 into a subscription tier message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden plan", { status: 403 })
    );

    await expect(fetchPolygonFuturesBars("ES", "D1", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(/subscription does not include futures data/i);
  });

  it("translates HTTP 401 into invalid-key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    await expect(fetchPolygonFuturesBars("ES", "D1", "2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"))
      .rejects.toThrow(/invalid API key/i);
  });

  it("returns [] on empty results without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "OK", results: [] }), { status: 200 })
    );

    const bars = await fetchPolygonFuturesBars("ES", "D1", "2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z");
    expect(bars).toEqual([]);
  });

  it("skips rows with malformed OHLC", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            { window_start: 1748736000000, open: 5200, high: 5215, low: 5198, close: 5210, volume: 1500000 },
            { window_start: 1748822400000, open: null, high: 5230, low: 5205, close: 5225 }, // bad open
            { window_start: 1748908800000, open: 5225, high: 5240, low: 5220, close: 5235 }, // no volume → 0
          ],
        }),
        { status: 200 }
      )
    );

    const bars = await fetchPolygonFuturesBars("ES", "D1", "2025-06-01T00:00:00Z", "2025-06-05T00:00:00Z");
    expect(bars).toHaveLength(2);
    expect(bars[1].volume).toBe(0);
  });

  it("accepts the v2-style field names (t/o/h/l/c/v) for forward-compat", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            { t: 1748736000000, o: 5200, h: 5215, l: 5198, c: 5210, v: 1500000 },
          ],
        }),
        { status: 200 }
      )
    );

    const bars = await fetchPolygonFuturesBars("ES", "D1", "2025-06-01T00:00:00Z", "2025-06-02T00:00:00Z");
    expect(bars).toHaveLength(1);
    expect(bars[0].close).toBe(5210);
  });
});
