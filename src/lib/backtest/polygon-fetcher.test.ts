import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapToPolygonTicker, fetchPolygonBars } from "./polygon-fetcher";

describe("mapToPolygonTicker", () => {
  it("maps forex pairs to C:* prefix", () => {
    expect(mapToPolygonTicker("EURUSD")).toEqual({ ticker: "C:EURUSD", assetClass: "forex" });
    expect(mapToPolygonTicker("GBPJPY")).toEqual({ ticker: "C:GBPJPY", assetClass: "forex" });
  });

  it("maps spot metals as forex pairs (XAUUSD / XAGUSD)", () => {
    expect(mapToPolygonTicker("XAUUSD")).toEqual({ ticker: "C:XAUUSD", assetClass: "forex" });
    expect(mapToPolygonTicker("XAGUSD")).toEqual({ ticker: "C:XAGUSD", assetClass: "forex" });
  });

  it("maps crypto pairs to X:* prefix", () => {
    expect(mapToPolygonTicker("BTCUSD")).toEqual({ ticker: "X:BTCUSD", assetClass: "crypto" });
    expect(mapToPolygonTicker("ETHUSD")).toEqual({ ticker: "X:ETHUSD", assetClass: "crypto" });
  });

  it("maps equity tickers without prefix", () => {
    expect(mapToPolygonTicker("AAPL")).toEqual({ ticker: "AAPL", assetClass: "stocks" });
    expect(mapToPolygonTicker("SPY")).toEqual({ ticker: "SPY", assetClass: "stocks" });
  });

  it("normalizes case", () => {
    expect(mapToPolygonTicker("eurusd")).toEqual({ ticker: "C:EURUSD", assetClass: "forex" });
  });

  it("returns null for unsupported symbols", () => {
    expect(mapToPolygonTicker("US500")).toBeNull(); // index CFD, not exposed by Polygon under our mapping
    expect(mapToPolygonTicker("ES")).toBeNull();   // futures ticker
    expect(mapToPolygonTicker("FOOBAR")).toBeNull();
  });
});

describe("fetchPolygonBars validation", () => {
  const ORIGINAL_KEY = process.env.POLYGON_API_KEY;

  beforeEach(() => {
    delete process.env.POLYGON_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY) process.env.POLYGON_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it("throws when POLYGON_API_KEY is not set", async () => {
    await expect(fetchPolygonBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/POLYGON_API_KEY not set/);
  });

  it("throws on unsupported symbol", async () => {
    process.env.POLYGON_API_KEY = "test-key";
    await expect(fetchPolygonBars("FOOBAR", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/No Polygon mapping/);
  });

  it("throws on invalid date range", async () => {
    process.env.POLYGON_API_KEY = "test-key";
    await expect(fetchPolygonBars("AAPL", "D1", "not-a-date", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/Invalid date range/);
  });
});

describe("fetchPolygonBars HTTP layer", () => {
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
            { t: 1735689600000, o: 100.0, h: 101.5, l: 99.8, c: 101.0, v: 12345 },
            { t: 1735776000000, o: 101.0, h: 102.3, l: 100.5, c: 102.1, v: 23456 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const bars = await fetchPolygonBars("AAPL", "D1", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/v2/aggs/ticker/AAPL/range/1/day/");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer test-key",
    });

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({
      ts: "2025-01-01T00:00:00.000Z",
      open: 100.0,
      high: 101.5,
      low: 99.8,
      close: 101.0,
      volume: 12345,
    });
  });

  it("URL-encodes the forex ticker (handles the colon)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "OK", results: [] }), { status: 200 })
    );

    await fetchPolygonBars("EURUSD", "H1", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/v2/aggs/ticker/C%3AEURUSD/range/1/hour/");
  });

  it("translates 429 into a rate-limit message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Too many requests", { status: 429 })
    );

    await expect(fetchPolygonBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/rate limit exceeded.*5 req\/min/i);
  });

  it("translates 403 into a subscription tier message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden plan", { status: 403 })
    );

    await expect(fetchPolygonBars("AAPL", "M1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/subscription does not include this data/i);
  });

  it("returns [] on empty results without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "OK", results: [] }), { status: 200 })
    );

    const bars = await fetchPolygonBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");
    expect(bars).toEqual([]);
  });

  it("skips rows with malformed OHLC values", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "OK",
          results: [
            { t: 1735689600000, o: 100.0, h: 101.5, l: 99.8, c: 101.0, v: 12345 },
            { t: 1735776000000, o: null, h: 102.3, l: 100.5, c: 102.1 },   // bad open
            { t: 1735862400000, o: 101.0, h: 102.5, l: 100.2, c: 102.0 }, // ok, no volume
          ],
        }),
        { status: 200 }
      )
    );

    const bars = await fetchPolygonBars("AAPL", "D1", "2025-01-01T00:00:00Z", "2025-01-05T00:00:00Z");
    expect(bars).toHaveLength(2);
    expect(bars[1].volume).toBe(0);
  });
});
