// Integration test for /api/algorithms/[id]/quality-gates GET handler (Wave 3
// item 12 — powers the Tier-1 gate breakdown panel, zero coverage despite
// gating whether an algorithm is allowed to trade real money).
//
// Covers: 401, 404 (algorithm not found), 500 (definitions query error), 500
// (results query error), breakdown dedup (latest row per gate_key wins),
// default NOT_READY score fallback when algorithm_quality_score has no row
// yet, happy path with a real score row.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "order", "limit", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/quality-gates", { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

const DEFINITIONS = [
  { gate_key: "min_trades", name: "Min Trades", category: "edge", severity: "must", threshold_op: ">=", threshold_value: 30, unit: "count", description: "d", sort_index: 1 },
  { gate_key: "sharpe_oos", name: "Sharpe OOS", category: "edge", severity: "should", threshold_op: ">=", threshold_value: 1, unit: "ratio", description: "d", sort_index: 2 },
];

function setupFromDispatch(opts: {
  algo?: { id: string; name: string; status: string } | null;
  definitions?: typeof DEFINITIONS | null;
  definitionsError?: { message: string } | null;
  results?: { gate_key: string; passed: boolean; value_observed: number | null; reason: string | null; computed_at: string }[];
  resultsError?: { message: string } | null;
  scoreRow?: Record<string, unknown> | null;
}) {
  const {
    algo = { id: "algo-1", name: "Test Algo", status: "live" },
    definitions = DEFINITIONS,
    definitionsError = null,
    results = [],
    resultsError = null,
    scoreRow = null,
  } = opts;

  fromMock.mockImplementation((table: string) => {
    if (table === "algorithms") return makeAwaitableChain({ data: algo, error: null });
    if (table === "algorithm_quality_gate_definitions") return makeAwaitableChain({ data: definitions, error: definitionsError });
    if (table === "algorithm_quality_gate_results") return makeAwaitableChain({ data: results, error: resultsError });
    if (table === "algorithm_quality_score") return makeAwaitableChain({ data: scoreRow, error: null });
    return makeAwaitableChain({ data: null, error: null });
  });
}

describe("/api/algorithms/[id]/quality-gates — GET", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    setupFromDispatch({ algo: null });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 500 when the definitions query errors", async () => {
    setupAuth();
    setupFromDispatch({ definitionsError: { message: "defs failed" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("defs failed");
  });

  it("returns 500 when the results query errors", async () => {
    setupAuth();
    setupFromDispatch({ resultsError: { message: "results failed" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("results failed");
  });

  it("returns a default NOT_READY score when algorithm_quality_score has no row yet", async () => {
    setupAuth();
    setupFromDispatch({ scoreRow: null });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.score).toMatchObject({
      algorithm_id: "algo-1",
      gates_total: 2,
      gates_passed: 0,
      must_failed: 0,
      tier: "NOT_READY",
    });
  });

  it("breakdown keeps only the latest row per gate_key (order-by computed_at desc, first wins)", async () => {
    setupAuth();
    setupFromDispatch({
      results: [
        { gate_key: "min_trades", passed: true, value_observed: 45, reason: null, computed_at: "2026-07-02T00:00:00Z" },
        { gate_key: "min_trades", passed: false, value_observed: 10, reason: "stale", computed_at: "2026-06-01T00:00:00Z" },
      ],
    });
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    const minTrades = body.breakdown.find((b: { gate_key: string }) => b.gate_key === "min_trades");
    expect(minTrades.passed).toBe(true);
    expect(minTrades.value_observed).toBe(45);
  });

  it("gate definitions with no matching result row show passed=null (never computed)", async () => {
    setupAuth();
    setupFromDispatch({ results: [] });
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    const sharpe = body.breakdown.find((b: { gate_key: string }) => b.gate_key === "sharpe_oos");
    expect(sharpe.passed).toBeNull();
    expect(sharpe.computed_at).toBeNull();
  });

  it("happy path: real score row is returned verbatim alongside the breakdown", async () => {
    setupAuth();
    setupFromDispatch({
      results: [{ gate_key: "min_trades", passed: true, value_observed: 45, reason: null, computed_at: "2026-07-02T00:00:00Z" }],
      scoreRow: { algorithm_id: "algo-1", gates_total: 2, gates_passed: 1, must_failed: 0, should_failed: 1, last_computed_at: "2026-07-02T00:00:00Z", tier: "TIER_2" },
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm).toMatchObject({ id: "algo-1", name: "Test Algo", status: "live" });
    expect(body.score).toMatchObject({ tier: "TIER_2", gates_passed: 1 });
    expect(body.breakdown).toHaveLength(2);
  });
});
