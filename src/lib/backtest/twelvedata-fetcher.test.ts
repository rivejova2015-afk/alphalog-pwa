import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapToTwelveDataSymbol, fetchTwelveDataBars } from "./twelvedata-fetcher";

describe("mapToTwelveDataSymbol", () => {
  it("maps forex pairs to slash notation", () => {
    expect(mapToTwelveDataSymbol("EURUSD")).toEqual({ symbol: "EUR/USD", assetClass: "forex" });
    expect(mapToTwelveDataSymbol("GBPJPY")).toEqual({ symbol: "GBP/JPY", assetClass: "forex" });
  });

  it("maps spot metals as forex pairs", () => {
    expect(mapToTwelveDataSymbol("XAUUSD")).toEqual({ symbol: "XAU/USD", assetClass: "forex" });
    expect(mapToTwelveDataSymbol("XAGUSD")).toEqual({ symbol: "XAG/USD", assetClass: "forex" });
  });

  it("maps crypto pairs to slash notation", () => {
    expect(mapToTwelveDataSymbol("BTCUSD")).toEqual({ symbol: "BTC/USD", assetClass: "crypto" });
    expect(mapToTwelveDataSymbol("ETHUSD")).toEqual({ symbol: "ETH/USD", assetClass: "crypto" });
  });

  it("maps equity tickers without modification", () => {
    expect(mapToTwelveDataSymbol("AAPL")).toEqual({ symbol: "AAPL", assetClass: "stocks" });
    expect(mapToTwelveDataSymbol("SPY")).toEqual({ symbol: "SPY", assetClass: "stocks" });
  });

  it("normalizes case", () => {
    expect(mapToTwelveDataSymbol("eurusd")).toEqual({ symbol: "EUR/USD", assetClass: "forex" });
  });

  it("returns null for unsupported symbols", () => {
    expect(mapToTwelveDataSymbol("US500")).toBeNull();
    expect(mapToTwelveDataSymbol("ES")).toBeNull();
    expect(mapToTwelveDataSymbol("FOOBAR")).toBeNull();
  });
});

describe("fetchTwelveDataBars validation", () => {
  const ORIGINAL_KEY = process.env.TWELVEDATA_API_KEY;

  beforeEach(() => {
    delete process.env.TWELVEDATA_API_KEY;
  });

  afterEach(() => {
    if (ORIGINAL_KEY) process.env.TWELVEDATA_API_KEY = ORIGINAL_KEY;
    vi.restoreAllMocks();
  });

  it("throws when TWELVEDATA_API_KEY is not set", async () => {
    await expect(fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/TWELVEDATA_API_KEY not set/);
  });

  it("throws on unsupported symbol", async () => {
    process.env.TWELVEDATA_API_KEY = "test-key";
    await expect(fetchTwelveDataBars("FOOBAR", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/No TwelveData mapping/);
  });

  it("throws on invalid date", async () => {
    process.env.TWELVEDATA_API_KEY = "test-key";
    await expect(fetchTwelveDataBars("AAPL", "D1", "not-a-date", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/Invalid date/);
  });
});

describe("fetchTwelveDataBars HTTP layer", () => {
  beforeEach(() => {
    process.env.TWELVEDATA_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.TWELVEDATA_API_KEY;
    vi.restoreAllMocks();
  });

  it("parses a successful response into Bar[] in ascending order", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "ok",
          meta: { symbol: "EUR/USD", interval: "1day" },
          values: [
            { datetime: "2025-01-01 00:00:00", open: "1.0500", high: "1.0550", low: "1.0480", close: "1.0520", volume: "12345" },
            { datetime: "2025-01-02 00:00:00", open: "1.0520", high: "1.0580", low: "1.0510", close: "1.0560", volume: "23456" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const bars = await fetchTwelveDataBars("EURUSD", "D1", "2025-01-01T00:00:00Z", "2025-01-02T00:00:00Z");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("api.twelvedata.com/time_series");
    expect(url).toContain("symbol=EUR%2FUSD");
    expect(url).toContain("interval=1day");
    expect(url).toContain("apikey=test-key");
    expect(url).toContain("order=ASC");

    expect(bars).toHaveLength(2);
    expect(bars[0]).toMatchObject({
      open: 1.05,
      high: 1.055,
      low: 1.048,
      close: 1.052,
      volume: 12345,
    });
    expect(bars[0].ts.startsWith("2025-01-01T00:00:00")).toBe(true);
  });

  it("uses slash notation for crypto symbols", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok", values: [] }), { status: 200 })
    );

    await fetchTwelveDataBars("BTCUSD", "H1", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("symbol=BTC%2FUSD");
    expect(url).toContain("interval=1h");
  });

  it("translates HTTP 429 into a rate-limit message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Too many requests", { status: 429 })
    );

    await expect(fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/rate limit.*8 req\/min.*800 req\/day/i);
  });

  it("translates HTTP 401 into invalid-key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 })
    );

    await expect(fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/invalid API key/i);
  });

  it("throws when API returns HTTP 200 with status:error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "error", code: 400, message: "symbol not found" }),
        { status: 200 }
      )
    );

    await expect(fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/symbol not found/i);
  });

  it("classifies status:error code 429 as rate limit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "error", code: 429, message: "credits exhausted" }),
        { status: 200 }
      )
    );

    await expect(fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/rate limit \/ credit error.*credits exhausted/i);
  });

  it("returns [] on empty values without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "ok", values: [] }), { status: 200 })
    );

    const bars = await fetchTwelveDataBars("AAPL", "D1", "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");
    expect(bars).toEqual([]);
  });

  it("skips rows with malformed OHLC", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: "ok",
          values: [
            { datetime: "2025-01-01 00:00:00", open: "1.0500", high: "1.0550", low: "1.0480", close: "1.0520", volume: "12345" },
            { datetime: "2025-01-02 00:00:00", open: "1.0520", high: "1.0580", low: "1.0510" },  // missing close
            { datetime: "2025-01-03 00:00:00", open: "1.0560", high: "1.0590", low: "1.0540", close: "1.0570" }, // no volume
          ],
        }),
        { status: 200 }
      )
    );

    const bars = await fetchTwelveDataBars("EURUSD", "D1", "2025-01-01T00:00:00Z", "2025-01-05T00:00:00Z");
    expect(bars).toHaveLength(2);
    expect(bars[1].volume).toBe(0);
  });
});
