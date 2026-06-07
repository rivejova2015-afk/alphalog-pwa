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
} = vi.hoisted(() => ({
  fromMock:                       vi.fn(),
  getUserMock:                    vi.fn(),
  runEngineV1FullValidationMock:  vi.fn(),
  extractMultiTfMock:             vi.fn(),
  evaluateEngineGatesMock:        vi.fn(),
  runAdvancedPipelineMock:        vi.fn(),
  buildKellyInputsMock:           vi.fn(),
  loadHistoricalBarsMock:         vi.fn(),
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
  runAdvancedPipelineMock.mockResolvedValue({ advanced: null, warnings: [] });
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
});
