// Integration test for /api/algorithms/[id]/backtest/sandbox POST handler
// (Wave 5 item 25 — multi-config sandbox / grid search).
//
// Covers: 401, 429 (rate limit 5/hr), 404 (algorithm not found), 400
// (invalid body, <2 variants, >8 variants, duplicate labels, not enough
// bars), happy path (runs the engine once per variant with rulesOverrides
// merged into config.rules — NOT config.parameters, which the engine
// ignores entirely; sizing merges shallowly so mode survives from the
// base config), picks the highest totalPnl as `best`.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  fromMock,
  checkRateLimitMock,
  loadBarsMock,
  runBacktestMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  fromMock:           vi.fn(),
  checkRateLimitMock: vi.fn(),
  loadBarsMock:       vi.fn(),
  runBacktestMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/aiRateLimit", () => ({
  checkAiRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/backtest/bars-loader", () => ({
  loadHistoricalBars: loadBarsMock,
}));
vi.mock("@/lib/backtest/engine", () => ({
  runBacktest: runBacktestMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

const VALID_CONFIG = {
  symbol: "XAUUSD",
  timeframe: "M15",
  from: "2026-01-01",
  to: "2026-02-01",
  initialBalance: 10000,
  contractSize: 100,
  pointValue: 1,
  spreadPoints: 2,
  commissionPerLot: 5,
  slippagePoints: 1,
  direction: "both",
  parameters: {},
  rules: { sizing: { mode: "fixed_lot", value: 0.1 }, slPoints: 100, tpPoints: 100 },
};

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/backtest/sandbox", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    duplex: "half",
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
  fromMock.mockReturnValue(makeAwaitableChain({ data: { id: "algo-1" }, error: null }));
}

const BAR = { ts: "2026-01-01T00:00:00Z", open: 2000, high: 2010, low: 1990, close: 2005, volume: 100 };
function bars(n: number) {
  return Array.from({ length: n }, (_, i) => ({ ...BAR, ts: `2026-01-01T${String(i % 24).padStart(2, "0")}:00:00Z` }));
}

const EMPTY_METRICS = {
  totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, totalReturnPct: 0,
  profitFactor: 0, expectancy: 0, sharpe: 0, sortino: 0, calmar: 0, maxDrawdown: 0,
  maxDrawdownPct: 0, recoveryFactor: 0, avgWin: 0, avgLoss: 0, avgWinLossRatio: 0,
  consecutiveWinsMax: 0, consecutiveLossesMax: 0, k_ratio: 0,
};

describe("/api/algorithms/[id]/backtest/sandbox — POST", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    checkRateLimitMock.mockReset();
    loadBarsMock.mockReset();
    runBacktestMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await POST(makeRequest({ config: VALID_CONFIG, variants: [] }), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    setupAuth(false);
    const res = await POST(makeRequest({ config: VALID_CONFIG, variants: [] }), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await POST(makeRequest({
      config: VALID_CONFIG,
      variants: [{ label: "a", rulesOverrides: {} }, { label: "b", rulesOverrides: {} }],
    }), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 400 when fewer than 2 variants are provided", async () => {
    setupAuth();
    const res = await POST(makeRequest({ config: VALID_CONFIG, variants: [{ label: "only-one", rulesOverrides: {} }] }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 when more than 8 variants are provided", async () => {
    setupAuth();
    const variants = Array.from({ length: 9 }, (_, i) => ({ label: `v${i}`, rulesOverrides: {} }));
    const res = await POST(makeRequest({ config: VALID_CONFIG, variants }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 when variant labels are duplicated", async () => {
    setupAuth();
    const res = await POST(makeRequest({
      config: VALID_CONFIG,
      variants: [{ label: "dupe", rulesOverrides: {} }, { label: "dupe", rulesOverrides: {} }],
    }), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/unique/i);
  });

  it("returns 400 when there aren't enough historical bars", async () => {
    setupAuth();
    loadBarsMock.mockResolvedValue(bars(10));
    const res = await POST(makeRequest({
      config: VALID_CONFIG,
      variants: [{ label: "a", rulesOverrides: {} }, { label: "b", rulesOverrides: {} }],
    }), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Not enough bars/i);
  });

  it("happy path: rulesOverrides.sizing.value reaches runBacktest merged into config.rules (not config.parameters)", async () => {
    setupAuth();
    loadBarsMock.mockResolvedValue(bars(100));
    runBacktestMock.mockImplementation(async (_bars: unknown, cfg: { rules: { sizing: { mode: string; value: number } } }) => {
      // Outcome deterministically derived from the sizing value that actually
      // reached the engine — proves the override took effect on `rules`,
      // the field runBacktest() actually reads (confirmed by reading
      // engine.ts before writing this route: it never touches `parameters`).
      return { metrics: { ...EMPTY_METRICS, totalPnl: cfg.rules.sizing.value * 1000 } };
    });

    const res = await POST(makeRequest({
      config: VALID_CONFIG,
      variants: [
        { label: "small-size", rulesOverrides: { sizing: { value: 0.1 } } },
        { label: "big-size", rulesOverrides: { sizing: { value: 0.5 } } },
      ],
    }), CTX);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(runBacktestMock).toHaveBeenCalledTimes(2);

    // sizing.mode is preserved from the base config even though only
    // `value` was overridden (shallow-merge of the sizing sub-object).
    const [, firstCallCfg] = runBacktestMock.mock.calls[0];
    expect(firstCallCfg.rules.sizing).toEqual({ mode: "fixed_lot", value: 0.1 });

    expect(body.results).toHaveLength(2);
    expect(body.results[0].metrics.totalPnl).toBe(100);
    expect(body.results[1].metrics.totalPnl).toBe(500);
    expect(body.best).toBe("big-size");
    expect(body.barsUsed).toBe(100);
  });

  it("slPoints/tpPoints overrides also reach config.rules", async () => {
    setupAuth();
    loadBarsMock.mockResolvedValue(bars(100));
    runBacktestMock.mockResolvedValue({ metrics: EMPTY_METRICS });

    await POST(makeRequest({
      config: VALID_CONFIG,
      variants: [
        { label: "tight-sl", rulesOverrides: { slPoints: 50 } },
        { label: "wide-sl", rulesOverrides: { slPoints: 200 } },
      ],
    }), CTX);

    const [, tightCfg] = runBacktestMock.mock.calls[0];
    const [, wideCfg] = runBacktestMock.mock.calls[1];
    expect(tightCfg.rules.slPoints).toBe(50);
    expect(wideCfg.rules.slPoints).toBe(200);
    // tpPoints untouched by the override stays at the base config's value.
    expect(tightCfg.rules.tpPoints).toBe(100);
  });
});
