// Integration test for /api/cron/algorithms/paper-review handler.
//
// Validates the Sprint P loop (Kelly refresh + paper → approved promotion):
//   1. 401 on bad cron secret.
//   2. 500 when the top-level algorithms select errors.
//   3. Empty list → ok with zero counts.
//   4. Per-algo trades select error → skipped with reason (loop continues).
//   5. Kelly payload exists + gates pass → promoted + kellyRefreshed=true.
//   6. Kelly payload null (<30 trades) + gates pass → promoted + kellyRefreshed=false.
//   7. Kelly update DB error → kellyRefreshed=false but promotion still
//      evaluated (failure-open guarantee).
//   8. Promotion gates fail → not promoted, gates_failed in reason.
//
// External deps mocked at module level so the route can be imported into
// the test without env/DB plumbing.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  fromMock,
  evaluatePaperGatesMock,
  buildKellyInputsFromTradesMock,
} = vi.hoisted(() => ({
  fromMock:                       vi.fn(),
  evaluatePaperGatesMock:         vi.fn(),
  buildKellyInputsFromTradesMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/engine/v1/paper-gates", () => ({
  evaluatePaperGates: evaluatePaperGatesMock,
}));
vi.mock("@/lib/engine/position-sizing/auto-populate", () => ({
  buildKellyInputsFromTrades: buildKellyInputsFromTradesMock,
  // mergeKellyInputs is pure — pass-through merge is fine.
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

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-cron-secret-1234567890";
  const mod = await import("../route");
  GET = mod.GET;
});

function makeRequest(secret = "test-cron-secret-1234567890"): NextRequest {
  return new NextRequest("http://localhost/api/cron/algorithms/paper-review", {
    method:  "GET",
    headers: { "x-cron-secret": secret },
  });
}

// Chain builder used by both algorithms list (.select().eq().is()) and
// trades list (.select().eq().order().limit()). All methods return `this`
// (the same proxy) until awaited as a Promise — that resolves to `result`.
function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "order", "limit", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

interface AlgoFixture {
  id:         string;
  user_id:    string;
  name:       string;
  status:     string;
  parameters: Record<string, unknown> | null;
}

function setupSupabase({
  algosResult,
  tradesResult,
  kellyUpdateResult,
  promoteResult,
}: {
  algosResult:       { data: AlgoFixture[] | null; error: { message: string } | null };
  tradesResult?:     { data: unknown[] | null; error: { message: string } | null };
  kellyUpdateResult?: { error: { message: string } | null };
  promoteResult?:    { error: { message: string } | null };
}) {
  fromMock.mockImplementation((table: string) => {
    // The route calls .from twice per algo: once on "algorithms" for the
    // initial select AND for the .update() chains (Kelly + promote). The
    // first .from('algorithms') call is the top-level select; subsequent
    // ones are updates.
    if (table === "algorithms") {
      // Track call count to differentiate select vs update.
      const callIdx = fromMock.mock.calls.filter((c) => c[0] === "algorithms").length;
      if (callIdx === 1) {
        // First "algorithms" call → list select.
        return makeAwaitableChain(algosResult);
      }
      // Subsequent "algorithms" calls → updates. Alternate Kelly vs promote
      // based on whether kellyUpdateResult was given for this algo.
      const updates = fromMock.mock.calls.filter((c) => c[0] === "algorithms").length - 1;
      if (updates === 1 && kellyUpdateResult !== undefined) {
        return makeAwaitableChain({ data: null, ...kellyUpdateResult });
      }
      return makeAwaitableChain({ data: null, ...(promoteResult ?? { error: null }) });
    }
    if (table === "algo_paper_trades") {
      return makeAwaitableChain(tradesResult ?? { data: [], error: null });
    }
    return makeAwaitableChain({ data: null, error: null });
  });
}

describe("/api/cron/algorithms/paper-review — handler", () => {
  beforeEach(() => {
    fromMock.mockReset();
    evaluatePaperGatesMock.mockReset();
    buildKellyInputsFromTradesMock.mockReset();
  });

  it("returns 401 on wrong cron secret", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the algorithms list select errors", async () => {
    setupSupabase({ algosResult: { data: null, error: { message: "db boom" } } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("db boom");
  });

  it("returns ok with zero counts when no paper algos exist", async () => {
    setupSupabase({ algosResult: { data: [], error: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reviewed).toBe(0);
    expect(body.promoted).toBe(0);
    expect(body.kelly_refreshed).toBe(0);
    expect(body.summary).toEqual([]);
  });

  it("skips the algo and continues when the trades select errors", async () => {
    setupSupabase({
      algosResult:  { data: [{ id: "a1", user_id: "u1", name: "A", status: "paper", parameters: {} }], error: null },
      tradesResult: { data: null, error: { message: "trades boom" } },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toHaveLength(1);
    expect(body.summary[0].reason).toBe("trades boom");
    expect(body.summary[0].promoted).toBe(false);
    expect(body.summary[0].kellyRefreshed).toBe(false);
    // Gates evaluator NOT called when trades select errored.
    expect(evaluatePaperGatesMock).not.toHaveBeenCalled();
  });

  it("refreshes Kelly + promotes when payload exists and gates pass", async () => {
    setupSupabase({
      algosResult:       { data: [{ id: "a1", user_id: "u1", name: "A", status: "paper", parameters: { contracts_per_trade: 1 } }], error: null },
      tradesResult:      { data: [{ pnl: 100, status: "closed" }], error: null },
      kellyUpdateResult: { error: null },
      promoteResult:     { error: null },
    });
    buildKellyInputsFromTradesMock.mockReturnValue({
      kelly_win_rate: 0.6, kelly_avg_win_usd: 100, kelly_avg_loss_usd: 50,
      kelly_inputs_updated_at: "2026-06-06T00:00:00Z",
      kelly_inputs_source: "paper_trades:a1",
      kelly_inputs_sample_size: 42,
    });
    evaluatePaperGatesMock.mockReturnValue({
      results: [], closedTrades: 42, totalPnl: 500, winRate: 0.6, daysLive: 10,
      allMustPassed: true, eligibleForApproved: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toHaveLength(1);
    expect(body.summary[0].promoted).toBe(true);
    expect(body.summary[0].kellyRefreshed).toBe(true);
    expect(body.summary[0].closedTrades).toBe(42);
    expect(body.kelly_refreshed).toBe(1);
    expect(body.promoted).toBe(1);
  });

  it("does NOT mark kellyRefreshed when payload is null (<30 trades)", async () => {
    setupSupabase({
      algosResult:   { data: [{ id: "a1", user_id: "u1", name: "A", status: "paper", parameters: {} }], error: null },
      tradesResult:  { data: [], error: null },
      promoteResult: { error: null },
    });
    buildKellyInputsFromTradesMock.mockReturnValue(null);  // <30 trades
    evaluatePaperGatesMock.mockReturnValue({
      results: [], closedTrades: 18, totalPnl: 200, winRate: 0.5, daysLive: 6,
      allMustPassed: true, eligibleForApproved: true,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.summary[0].promoted).toBe(true);
    expect(body.summary[0].kellyRefreshed).toBe(false);
    expect(body.kelly_refreshed).toBe(0);
    expect(body.promoted).toBe(1);
  });

  it("continues to gate evaluation when the Kelly update DB errors (failure-open)", async () => {
    setupSupabase({
      algosResult:       { data: [{ id: "a1", user_id: "u1", name: "A", status: "paper", parameters: {} }], error: null },
      tradesResult:      { data: [], error: null },
      kellyUpdateResult: { error: { message: "update failed" } },
      promoteResult:     { error: null },
    });
    buildKellyInputsFromTradesMock.mockReturnValue({
      kelly_win_rate: 0.55, kelly_avg_win_usd: 100, kelly_avg_loss_usd: 80,
      kelly_inputs_updated_at: "2026-06-06T00:00:00Z",
      kelly_inputs_source: "paper_trades:a1",
      kelly_inputs_sample_size: 30,
    });
    // Gates fail → not promoted, but Kelly path still ran.
    evaluatePaperGatesMock.mockReturnValue({
      results: [{ key: "win_rate", label: "WR", tier: "must" as const, value: 0.3, threshold: 0.4, passed: false }],
      closedTrades: 30, totalPnl: -50, winRate: 0.3, daysLive: 7,
      allMustPassed: false, eligibleForApproved: false,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.summary[0].promoted).toBe(false);
    expect(body.summary[0].kellyRefreshed).toBe(false);
    expect(body.summary[0].reason).toMatch(/^gates_failed:/);
    // Gates evaluator WAS called — Kelly update failure did NOT short-circuit.
    expect(evaluatePaperGatesMock).toHaveBeenCalled();
  });

  it("reports gates_failed reason with the failing 'must' gate keys", async () => {
    setupSupabase({
      algosResult:  { data: [{ id: "a1", user_id: "u1", name: "A", status: "paper", parameters: {} }], error: null },
      tradesResult: { data: [], error: null },
    });
    buildKellyInputsFromTradesMock.mockReturnValue(null);
    evaluatePaperGatesMock.mockReturnValue({
      results: [
        { key: "closed_trades", label: "Min trades", tier: "must" as const, value: 5, threshold: 15, passed: false },
        { key: "days_live",     label: "Min days",   tier: "must" as const, value: 2, threshold: 5,  passed: false },
        { key: "total_pnl",     label: "Pos PnL",    tier: "must" as const, value: 100, threshold: 0, passed: true },
      ],
      closedTrades: 5, totalPnl: 100, winRate: 0.6, daysLive: 2,
      allMustPassed: false, eligibleForApproved: false,
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.summary[0].promoted).toBe(false);
    expect(body.summary[0].reason).toBe("gates_failed:closed_trades,days_live");
    expect(body.promoted).toBe(0);
  });
});
