import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("checkFearGreed", () => {
  beforeEach(() => {
    vi.resetModules(); // clear cache between tests
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path: parsea value + classification + allow=true", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ value: "75", value_classification: "Greed" }] }),
    });
    const { checkFearGreed } = await import("../src/validators/fear-greed.js");
    const r = await checkFearGreed();
    expect(r.allow).toBe(true);
    expect(r.value).toBe(75);
    expect(r.classification).toBe("Greed");
    expect(typeof r.threshold).toBe("number");
  });

  it("API 500 → fallback a value=50 + classification=Neutral", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    });
    const { checkFearGreed } = await import("../src/validators/fear-greed.js");
    const r = await checkFearGreed();
    expect(r.allow).toBe(true);
    expect(r.value).toBe(50);
    expect(r.classification).toBe("Neutral");
  });

  it("payload vacío → fallback", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const { checkFearGreed } = await import("../src/validators/fear-greed.js");
    const r = await checkFearGreed();
    expect(r.value).toBe(50);
  });

  it("usa cache cuando se llama dos veces en <5min", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ value: "80", value_classification: "Extreme Greed" }] }),
    });
    const { checkFearGreed } = await import("../src/validators/fear-greed.js");
    await checkFearGreed();
    await checkFearGreed();
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("threshold viene de FEAR_GREED_GATE config", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ value: "50", value_classification: "Neutral" }] }),
    });
    const { checkFearGreed } = await import("../src/validators/fear-greed.js");
    const { FEAR_GREED_GATE } = await import("../src/core/config.js");
    const r = await checkFearGreed();
    expect(r.threshold).toBe(FEAR_GREED_GATE);
  });
});

describe("fetchLiquidationHeatmap", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.COINGLASS_API_KEY;
  });

  it("sin COINGLASS_API_KEY → available=false con arrays vacíos", async () => {
    const { fetchLiquidationHeatmap } = await import("../src/validators/liquidation-heatmap.js");
    const r = await fetchLiquidationHeatmap("BTC-USD", 50_000);
    expect(r.available).toBe(false);
    expect(r.levels).toEqual([]);
    expect(r.nearestLong).toBeNull();
    expect(r.nearestShort).toBeNull();
  });

  it("con COINGLASS_API_KEY → stub aún retorna available=false (TODO)", async () => {
    process.env.COINGLASS_API_KEY = "fake-key";
    const { fetchLiquidationHeatmap } = await import("../src/validators/liquidation-heatmap.js");
    const r = await fetchLiquidationHeatmap("BTC-USD", 50_000);
    // El stub actual sigue retornando available=false hasta que se implemente Coinglass v3
    expect(r.available).toBe(false);
  });
});
