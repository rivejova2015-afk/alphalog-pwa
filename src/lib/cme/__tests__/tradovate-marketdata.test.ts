import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTradovateBars } from "../tradovate-marketdata";

describe("fetchTradovateBars", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("returns [] for unsupported timeframes (W1, MN1)", async () => {
    global.fetch = vi.fn();
    const r = await fetchTradovateBars("tok", true, "ESM5", "W1", "2026-05-01T00:00:00Z", "2026-06-01T00:00:00Z");
    expect(r).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns [] for invalid timestamp range (to <= from)", async () => {
    global.fetch = vi.fn();
    const r = await fetchTradovateBars("tok", true, "ESM5", "M15", "2026-06-01T00:00:00Z", "2026-05-01T00:00:00Z");
    expect(r).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("maps a successful response to Bar[] with summed volume", async () => {
    const fakeResponse = {
      historicalChart: {
        bars: [
          { timestamp: "2026-06-01T14:00:00Z", open: 5000, high: 5010, low: 4995, close: 5005, upVolume: 100, downVolume: 50 },
          { timestamp: "2026-06-01T14:15:00Z", open: 5005, high: 5020, low: 5000, close: 5018, upVolume: 200, downVolume: 100 },
        ],
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    });

    const r = await fetchTradovateBars("tok", true, "ESM5", "M15",
      "2026-06-01T13:00:00Z", "2026-06-01T15:00:00Z");

    expect(r).toHaveLength(2);
    expect(r[0].ts).toBe("2026-06-01T14:00:00.000Z");
    expect(r[0].volume).toBe(150);
    expect(r[1].volume).toBe(300);
    expect(r[1].close).toBe(5018);
  });

  it("filters bars outside the requested window", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        historicalChart: {
          bars: [
            { timestamp: "2026-05-30T00:00:00Z", open: 1, high: 1, low: 1, close: 1, upVolume: 0, downVolume: 0 }, // outside
            { timestamp: "2026-06-01T14:00:00Z", open: 2, high: 2, low: 2, close: 2, upVolume: 10, downVolume: 10 }, // inside
          ],
        },
      }),
    });

    const r = await fetchTradovateBars("tok", true, "ESM5", "M15",
      "2026-06-01T13:00:00Z", "2026-06-01T15:00:00Z");

    expect(r).toHaveLength(1);
    expect(r[0].close).toBe(2);
  });

  it("throws on non-OK HTTP responses", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "expired token",
    });

    await expect(
      fetchTradovateBars("tok", true, "ESM5", "M15",
        "2026-06-01T13:00:00Z", "2026-06-01T15:00:00Z"),
    ).rejects.toThrow(/Tradovate getChart failed \(401\)/);
  });

  it("hits the demo-api URL when isPaper=true", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ historicalChart: { bars: [] } }),
    });
    await fetchTradovateBars("tok", true, "ESM5", "M15",
      "2026-06-01T13:00:00Z", "2026-06-01T15:00:00Z");
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("demo-api.tradovate.com");
  });

  it("hits the live-api URL when isPaper=false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ historicalChart: { bars: [] } }),
    });
    await fetchTradovateBars("tok", false, "ESM5", "M15",
      "2026-06-01T13:00:00Z", "2026-06-01T15:00:00Z");
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("live-api.tradovate.com");
  });

  it("maps H4 to MinuteBar size 240", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ historicalChart: { bars: [] } }),
    });
    global.fetch = fetchMock;
    await fetchTradovateBars("tok", true, "ESM5", "H4",
      "2026-06-01T00:00:00Z", "2026-06-01T15:00:00Z");
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.chartDescription.underlyingType).toBe("MinuteBar");
    expect(body.chartDescription.elementSize).toBe(240);
  });

  it("maps D1 to DailyBar size 1", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ historicalChart: { bars: [] } }),
    });
    global.fetch = fetchMock;
    await fetchTradovateBars("tok", true, "ESM5", "D1",
      "2026-05-01T00:00:00Z", "2026-06-01T00:00:00Z");
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.chartDescription.underlyingType).toBe("DailyBar");
    expect(body.chartDescription.elementSize).toBe(1);
  });
});
