import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapToOandaInstrument, fetchOandaBars } from "./oanda-fetcher";

describe("mapToOandaInstrument", () => {
  it("maps majors with underscore", () => {
    expect(mapToOandaInstrument("EURUSD")).toBe("EUR_USD");
    expect(mapToOandaInstrument("USDJPY")).toBe("USD_JPY");
  });

  it("maps metals to OANDA spot codes", () => {
    expect(mapToOandaInstrument("XAUUSD")).toBe("XAU_USD");
    expect(mapToOandaInstrument("XAGUSD")).toBe("XAG_USD");
  });

  it("normalizes case", () => {
    expect(mapToOandaInstrument("eurusd")).toBe("EUR_USD");
  });

  it("returns null for unsupported symbols", () => {
    expect(mapToOandaInstrument("ES")).toBeNull();
    expect(mapToOandaInstrument("BTCUSD")).toBeNull();
    expect(mapToOandaInstrument("FOOBAR")).toBeNull();
  });
});

describe("fetchOandaBars — env + arg validation", () => {
  const originalToken = process.env.OANDA_API_TOKEN;

  beforeEach(() => {
    delete process.env.OANDA_API_TOKEN;
  });

  afterEach(() => {
    if (originalToken !== undefined) process.env.OANDA_API_TOKEN = originalToken;
  });

  it("throws when OANDA_API_TOKEN is missing", async () => {
    await expect(fetchOandaBars("EURUSD", "M15", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/OANDA_API_TOKEN not set/);
  });

  it("throws on unsupported symbol (even when token IS set)", async () => {
    process.env.OANDA_API_TOKEN = "dummy_token_for_test";
    await expect(fetchOandaBars("BTCUSD", "M15", "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"))
      .rejects.toThrow(/No OANDA mapping/);
  });
});
