// Integration test for /api/algorithms/[id]/engine-backtest POST handler.
//
// Validates the Sprint N Kelly auto-populate branch + the surrounding
// lifecycle wiring:
//   1. 401 when unauthenticated.
//   2. 400 when body fails Zod validation.
//   3. 404 when the algorithm row isn't found.
//   4. 400 when no symbol is resolvable (no body.symbol AND empty
//      algorithm.instrument).
//   5. Happy path with statistically-meaningful metrics → kelly_populated=true,
//      response includes kelly_inputs payload, algorithms UPDATE runs with
//      merged params.
//   6. Sample too small (<30 trades) → kelly_populated=false, response
//      kelly_inputs=null, algorithms UPDATE NOT called for Kelly.
//   7. Kelly UPDATE DB error → kelly_populated=false but the request still
//      returns 200 (failure-open guarantee). algorithm.status reflects the
//      promotion path independently.
//   8. Draft → paper auto-promote runs when gates eligible. Response algorithm
//      status reflects the promoted state.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  fromMock,
  getUserMock,
  runEngineV1FullValidationMock,
  extractMultiTfMock,
  evaluateEngineGatesMock,
  runAdvancedPipelineMock,
  buildKellyInputsMock,
  loadHistoricalBarsMock,
  runPortfolioMock,
  buildBiasCacheMock,
  multiTfBlocksMock,
  summarizeAlignmentMock,
} = vi.hoisted(() => ({
  fromMock:                       vi.fn(),
  getUserMock:                    vi.fn(),
  runEngineV1FullValidationMock:  vi.fn(),
  extractMultiTfMock:             vi.fn(),
  evaluateEngineGatesMock:        vi.fn(),
  runAdvancedPipelineMock:        vi.fn(),
  buildKellyInputsMock:           vi.fn(),
  loadHistoricalBarsMock:         vi.fn(),
  runPortfolioMock:               vi.fn(),
  buildBiasCacheMock:             vi.fn(),
  multiTfBlocksMock:              vi.fn(),
  summarizeAlignmentMock:         vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/engine/v1/backtest", () => ({
  runEngineV1FullValidation: runEngineV1FullValidationMock,
}));
vi.mock("@/lib/engine/v1/index", () => ({
  extractMultiTf: extractMultiTfMock,
}));
vi.mock("@/lib/engine/v1/quality-gates", () => ({
  evaluateEngineGates: evaluateEngineGatesMock,
}));
vi.mock("@/lib/backtest/orchestrator", () => ({
  runAdvancedPipeline: runAdvancedPipelineMock,
}));
vi.mock("@/lib/backtest/portfolio", () => ({
  runPortfolio: runPortfolioMock,
}));
vi.mock("@/lib/backtest/multi-tf-filter", () => ({
  buildBiasCache:     buildBiasCacheMock,
  multiTfBlocks:      multiTfBlocksMock,
  summarizeAlignment: summarizeAlignmentMock,
}));
vi.mock("@/lib/backtest/bars-loader", () => ({
  loadHistoricalBars: loadHistoricalBarsMock,
}));
vi.mock("@/lib/backtest/options-overlay", () => ({
  theoreticalOptionPnl: vi.fn(),
}));
vi.mock("@/lib/engine/position-sizing/auto-populate", () => ({
  buildKellyInputs: buildKellyInputsMock,
  mergeKellyInputs: (existing: Record<string, unknown> | null | undefined, payload: Record<string, unknown>) => ({
    ...(existing ?? {}),
    ...payload,
  }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
  logInfo:  vi.fn(),
  logWarn:  vi.fn(),
}));

let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

// Awaitable chain proxy — supports the select/eq/is/in/maybeSingle/insert/update
// patterns the route touches. Resolves to `result` when awaited.
function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit", "update", "insert", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/engine-backtest", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

// Baseline metrics that PASS Kelly's 30-trade + positive-edge floor.
const goodMetrics = {
  totalTrades: 50, wins: 30, losses: 20,
  winRate: 0.6, totalPnl: 1500, totalReturnPct: 0.15,
  profitFactor: 1.8, expectancy: 30,
  sharpe: 1.2, sortino: 1.8, calmar: 1.0,
  maxDrawdown: 500, maxDrawdownPct: 0.05, recoveryFactor: 3.0,
  avgWin: 80, avgLoss: 40, avgWinLossRatio: 2.0,
  consecutiveWinsMax: 5, consecutiveLossesMax: 3, k_ratio: 1.5,
};

const goodValidationResult = {
  baseline: {
    metrics:       goodMetrics,
    trades:        [],
    equityCurve:   [],
    finalBalance:  101_500,
    durationMs:    300,
  },
  monteCarlo:  null,
  walkForward: null,
};

const goodKellyPayload = {
  kelly_win_rate:           0.6,
  kelly_avg_win_usd:        80,
  kelly_avg_loss_usd:       40,
  kelly_inputs_updated_at:  "2026-06-06T00:00:00Z",
  kelly_inputs_source:      "engine_backtest:run-1",
  kelly_inputs_sample_size: 50,
};

// Default mock baseline — overridable per-test via setupSupabase().
function setupHappyDefaults(opts: {
  algoStatus?:        string;
  algoParameters?:    Record<string, unknown>;
  kellyPayload?:      typeof goodKellyPayload | null;
  kellyUpdateError?:  { message: string } | null;
  gatesEligible?:     boolean;
} = {}) {
  const {
    algoStatus       = "draft",
    algoParameters   = {},
    kellyPayload     = goodKellyPayload,
    kellyUpdateError = null,
    gatesEligible    = false,
  } = opts;

  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

  extractMultiTfMock.mockReturnValue({ timeframes: [{ tf: "M15", weight: 1 }] });
  loadHistoricalBarsMock.mockResolvedValue([]);
  runEngineV1FullValidationMock.mockResolvedValue(goodValidationResult);
  // runAdvancedPipeline is synchronous in the route — return a plain object.
  runAdvancedPipelineMock.mockReturnValue({ advanced: null, warnings: [] });
  evaluateEngineGatesMock.mockReturnValue({
    eligibleForPaper: gatesEligible,
    results: [],
  });
  buildKellyInputsMock.mockReturnValue(kellyPayload);

  // Sequence of .from() calls in happy path:
  //   1. "algorithms" — select algo row
  //   2. "engine_backtest_runs" — insert run row
  //   3. "algorithms" — UPDATE promote (only if gates eligible AND draft)
  //   4. "algorithms" — UPDATE Kelly (only if payload exists)
  const algoRow = {
    id:            "algo-1",
    name:          "Test algo",
    status:        algoStatus,
    engine_config: null,
    parameters:    algoParameters,
    instrument:    "ES",
    lot_size:      1,
    market_type:   "futures",
  };

  let promoteCalled = false;
  let kellyUpdateCalled = false;

  fromMock.mockImplementation((table: string) => {
    if (table === "algorithms") {
      const algoCalls = fromMock.mock.calls.filter((c) => c[0] === "algorithms").length;
      if (algoCalls === 1) {
        // First call: select algo.
        return makeAwaitableChain({ data: algoRow, error: null });
      }
      // Subsequent calls are UPDATES (promote or Kelly).
      // Differentiate via order: promote runs first IF gates eligible AND
      // draft; then Kelly. If gates NOT eligible, only Kelly runs.
      if (gatesEligible && algoStatus === "draft" && !promoteCalled) {
        promoteCalled = true;
        return makeAwaitableChain({ data: null, error: null });
      }
      kellyUpdateCalled = true;
      return makeAwaitableChain({ data: null, error: kellyUpdateError });
    }
    if (table === "engine_backtest_runs") {
      return makeAwaitableChain({ data: { id: "run-1", created_at: "2026-06-06T00:00:00Z" }, error: null });
    }
    return makeAwaitableChain({ data: null, error: null });
  });

  return { getKellyUpdateCalled: () => kellyUpdateCalled, getPromoteCalled: () => promoteCalled };
}

describe("/api/algorithms/[id]/engine-backtest — handler", () => {
  beforeEach(() => {
    fromMock.mockReset();
    getUserMock.mockReset();
    runEngineV1FullValidationMock.mockReset();
    extractMultiTfMock.mockReset();
    evaluateEngineGatesMock.mockReset();
    runAdvancedPipelineMock.mockReset();
    buildKellyInputsMock.mockReset();
    loadHistoricalBarsMock.mockReset();
    runPortfolioMock.mockReset();
    buildBiasCacheMock.mockReset();
    multiTfBlocksMock.mockReset();
    summarizeAlignmentMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body fails Zod validation", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await POST(makeRequest({ starting_equity: -100 }), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toBeDefined();
  });

  it("returns 404 when the algorithm is not found", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Algorithm not found");
  });

  it("returns 400 when no symbol is resolvable", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: {
        id: "algo-1", name: "x", status: "draft",
        engine_config: null, parameters: {},
        instrument: null, // ← empty + no body symbol = 400
        lot_size: 1, market_type: "futures",
      },
      error: null,
    }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No symbol available");
  });

  it("persists Kelly inputs into parameters when metrics meet the threshold", async () => {
    const handle = setupHappyDefaults();

    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.kelly_populated).toBe(true);
    expect(body.kelly_inputs).toEqual(goodKellyPayload);
    expect(handle.getKellyUpdateCalled()).toBe(true);
    expect(buildKellyInputsMock).toHaveBeenCalledOnce();
  });

  it("returns kelly_populated=false when payload is null (sample too small)", async () => {
    const handle = setupHappyDefaults({ kellyPayload: null });

    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.kelly_populated).toBe(false);
    expect(body.kelly_inputs).toBeNull();
    expect(handle.getKellyUpdateCalled()).toBe(false);
    expect(buildKellyInputsMock).toHaveBeenCalledOnce();
  });

  it("returns 200 with kelly_populated=false when the Kelly UPDATE errors (failure-open)", async () => {
    setupHappyDefaults({ kellyUpdateError: { message: "constraint violation" } });

    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.kelly_populated).toBe(false);
    // The payload is still returned in the response so the UI knows what would
    // have been written — useful for telemetry / "stats unchanged" messaging.
    expect(body.kelly_inputs).toEqual(goodKellyPayload);
  });

  it("auto-promotes draft → paper when engine gates eligible and reflects in response", async () => {
    const handle = setupHappyDefaults({ algoStatus: "draft", gatesEligible: true });

    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.promoted).toBe(true);
    expect(body.algorithm.status).toBe("paper");
    expect(handle.getPromoteCalled()).toBe(true);
  });

  it("does NOT promote when gates ineligible — algorithm status stays draft", async () => {
    setupHappyDefaults({ algoStatus: "draft", gatesEligible: false });

    const res = await POST(makeRequest(), CTX);
    const body = await res.json();
    expect(body.promoted).toBe(false);
    expect(body.algorithm.status).toBe("draft");
  });

  it("hydrates the multi-TF block to 'completed' when use_multi_tf=true (sync flow)", async () => {
    setupHappyDefaults();
    // Baseline with 3 trades so multiTfBlocks counting is observable.
    runEngineV1FullValidationMock.mockResolvedValue({
      ...goodValidationResult,
      baseline: {
        ...goodValidationResult.baseline,
        trades: [
          { side: "long",  entryTs: "2026-01-02T00:00:00Z" },
          { side: "short", entryTs: "2026-01-03T00:00:00Z" },
          { side: "long",  entryTs: "2026-01-04T00:00:00Z" },
        ],
      },
    });
    // Orchestrator surfaces multi-TF intent as 'pending'; the route hydrates it.
    runAdvancedPipelineMock.mockReturnValue({
      advanced: {
        ml: null,
        multiTf: { used: true, status: "pending", higherTimeframes: ["H4", "D1"] },
        portfolio: null,
      },
      warnings: [],
    });
    // Higher-TF bar loads return >= MIN_TF_BARS (50) bars so they're not skipped.
    loadHistoricalBarsMock.mockResolvedValue(new Array(120).fill({ ts: "2026-01-01T00:00:00Z", open: 1, high: 1, low: 1, close: 1, volume: 1 }));
    buildBiasCacheMock.mockReturnValue(new Map([["H4", {}], ["D1", {}]]));
    // First two trades contradict the higher TF, third doesn't.
    multiTfBlocksMock.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
    summarizeAlignmentMock.mockReturnValue({
      byTf: { H4: { bull: 10, bear: 5, neutral: 2 }, D1: { bull: 8, bear: 4, neutral: 5 } },
      totalPrimaryBars: 17,
    });

    const res = await POST(makeRequest({ use_multi_tf: true }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.advanced.multiTf.status).toBe("completed");
    expect(body.advanced.multiTf.tradesFilteredCount).toBe(2);
    expect(body.advanced.multiTf.alignment.totalPrimaryBars).toBe(17);
    expect(buildBiasCacheMock).toHaveBeenCalledOnce();
    expect(multiTfBlocksMock).toHaveBeenCalledTimes(3);
  });

  it("hydrates the multi-TF block to 'failed' when no higher-TF bars load", async () => {
    setupHappyDefaults();
    runAdvancedPipelineMock.mockReturnValue({
      advanced: {
        ml: null,
        multiTf: { used: true, status: "pending", higherTimeframes: ["H4", "D1"] },
        portfolio: null,
      },
      warnings: [],
    });
    // Too few bars → every higher TF skipped → block fails.
    loadHistoricalBarsMock.mockResolvedValue(new Array(10).fill({ ts: "2026-01-01T00:00:00Z", open: 1, high: 1, low: 1, close: 1, volume: 1 }));

    const res = await POST(makeRequest({ use_multi_tf: true }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.advanced.multiTf.status).toBe("failed");
    expect(body.advanced.multiTf.reason).toContain("no higher-TF bars loaded");
    expect(buildBiasCacheMock).not.toHaveBeenCalled();
  });

  it("hydrates the portfolio block to 'completed' when use_portfolio=true with >=2 legs", async () => {
    setupHappyDefaults();
    runAdvancedPipelineMock.mockReturnValue({
      advanced: {
        ml: null,
        multiTf: null,
        portfolio: { used: true, status: "pending", reason: "needs supabase" },
      },
      warnings: [],
    });
    runPortfolioMock.mockResolvedValue({
      metrics: {
        totalPnl: 1200, totalReturnPct: 12, sharpe: 1.4,
        maxDrawdown: 300, maxDrawdownPct: 3,
        legCorrelations: [{ a: "leg-a", b: "leg-b", rho: 0.2 }],
      },
      portfolioEquity: [
        { ts: "2026-01-01T00:00:00Z", equity: 10000, drawdown: 0 },
        { ts: "2026-01-02T00:00:00Z", equity: 11200, drawdown: 0 },
      ],
    });

    const res = await POST(makeRequest({
      use_portfolio: true,
      legs: [
        { configId: "leg-a", symbol: "EURUSD", weight: 0.5 },
        { configId: "leg-b", symbol: "XAUUSD", weight: 0.5 },
      ],
    }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.advanced.portfolio.status).toBe("completed");
    expect(body.advanced.portfolio.legCount).toBe(2);
    expect(body.advanced.portfolio.metrics.sharpe).toBe(1.4);
    expect(body.advanced.portfolio.equityPreviewLast50).toHaveLength(2);
    expect(runPortfolioMock).toHaveBeenCalledOnce();
    // Each leg's cfg should scale initialBalance by its weight (10000 × 0.5).
    const legsArg = runPortfolioMock.mock.calls[0][1] as Array<{ cfg: { initialBalance: number; symbol: string } }>;
    expect(legsArg).toHaveLength(2);
    expect(legsArg[0].cfg.initialBalance).toBe(5000);
    expect(legsArg[0].cfg.symbol).toBe("EURUSD");
  });

  it("marks portfolio 'failed' when runPortfolio throws (failure isolated)", async () => {
    setupHappyDefaults();
    runAdvancedPipelineMock.mockReturnValue({
      advanced: {
        ml: null,
        multiTf: null,
        portfolio: { used: true, status: "pending", reason: "needs supabase" },
      },
      warnings: [],
    });
    runPortfolioMock.mockRejectedValue(new Error("bars unavailable for XAUUSD"));

    const res = await POST(makeRequest({
      use_portfolio: true,
      legs: [
        { configId: "leg-a", symbol: "EURUSD", weight: 0.5 },
        { configId: "leg-b", symbol: "XAUUSD", weight: 0.5 },
      ],
    }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.advanced.portfolio.status).toBe("failed");
    expect(body.advanced.portfolio.reason).toContain("bars unavailable");
    expect(body.advanced_warnings).toContain("portfolio: bars unavailable for XAUUSD");
  });
});
