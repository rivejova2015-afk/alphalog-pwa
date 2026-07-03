// Integration test for /api/algorithms/[id]/deploy POST/DELETE handlers.
//
// Covers the Wave 1 security fixes:
//   1. Global kill-switch blocks new deploys (423) — item 3.
//   2. approved→live transition now runs computeGates and blocks (403) on
//      failure — item 1 (closes the bypass that let an algorithm reach
//      "live" without ever passing a single quality gate).
//   3. Already-live algorithms skip the gate re-check (no friction for
//      adding more accounts to a proven algorithm).
// Plus baseline coverage this endpoint never had before: 401, 429, 404,
// 409 (wrong status), 403 (unowned bot_account), happy path.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  fromMock,
  computeGatesMock,
  checkRateLimitMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  fromMock:           vi.fn(),
  computeGatesMock:   vi.fn(),
  checkRateLimitMock: vi.fn(),
  logAuditMock:       vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/quality-gates/runner", () => ({
  computeGates: computeGatesMock,
}));
vi.mock("@/lib/security/aiRateLimit", () => ({
  checkAiRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/security/auditLog", () => ({
  logAuditFromRequest: logAuditMock,
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
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "insert", "update", "upsert"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(body: unknown = { bot_account_ids: ["11111111-1111-4111-8111-111111111111"] }): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/deploy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // body but isn't in the TS DOM lib types yet.
    duplex: "half",
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
}

/**
 * Dispatch mock: routes .from(table) calls to per-table canned responses.
 * `algorithmsSequence` lets the two separate `.from("algorithms")` calls
 * (initial status lookup vs nothing-else, since the final status update
 * doesn't await a response in the real handler) resolve differently if
 * needed — most tests only need the first lookup.
 */
function setupFromDispatch(opts: {
  halted?: boolean;
  algo?: { id: string; status: string; platform?: string | null } | null;
  ownedAccounts?: { id: string }[];
  deployError?: { message: string } | null;
}) {
  const {
    halted = false,
    algo = { id: "algo-1", status: "approved", platform: "MT4" },
    ownedAccounts = [{ id: "11111111-1111-4111-8111-111111111111" }],
    deployError = null,
  } = opts;

  fromMock.mockImplementation((table: string) => {
    if (table === "global_trading_halt") {
      return makeAwaitableChain({ data: { halted }, error: null });
    }
    if (table === "algorithms") {
      return makeAwaitableChain({ data: algo, error: null });
    }
    if (table === "bot_accounts") {
      return makeAwaitableChain({ data: ownedAccounts, error: null });
    }
    if (table === "algorithm_deployments") {
      return makeAwaitableChain({
        data: deployError ? null : [{ id: "dep-1", bot_account_id: "11111111-1111-4111-8111-111111111111", status: "active" }],
        error: deployError,
      });
    }
    return makeAwaitableChain({ data: null, error: null });
  });
}

describe("/api/algorithms/[id]/deploy — POST handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    computeGatesMock.mockReset();
    checkRateLimitMock.mockReset();
    logAuditMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded", async () => {
    setupAuth(false);
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("returns 400 on invalid body", async () => {
    setupAuth();
    const res = await POST(makeRequest({ bot_account_ids: [] }), CTX);
    expect(res.status).toBe(400);
  });

  // ── Item 3: global kill-switch ──────────────────────────────────────────
  it("returns 423 when global trading halt is active", async () => {
    setupAuth();
    setupFromDispatch({ halted: true });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(423);
    // Gate check + downstream lookups never reached.
    expect(computeGatesMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    setupFromDispatch({ algo: null });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 409 when algorithm status is not approved/live", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "paper" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(409);
  });

  it("returns 403 when a requested bot_account is not owned by the user", async () => {
    setupAuth();
    setupFromDispatch({ ownedAccounts: [] }); // none of the requested accounts belong to u1
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
  });

  // ── Item 1: close the /deploy quality-gate bypass ───────────────────────
  it("runs computeGates and blocks with 403 when approved→live and must_failed > 0", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "approved" } });
    computeGatesMock.mockResolvedValue({
      score:   { gates_passed: 15, gates_total: 20, must_failed: 5, tier: "NOT_READY" },
      results: [{ gate_key: "sharpe_oos", passed: false, reason: "sharpe 0.8 < 1.5" }],
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/quality gates.*deploy blocked/i);
    expect(body.failed).toHaveLength(1);
    expect(computeGatesMock).toHaveBeenCalledWith(expect.anything(), "algo-1", "u1");
  });

  it("blocks with 403 when approved→live and gates_passed < gates_total (should-gates failing)", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "approved" } });
    computeGatesMock.mockResolvedValue({
      score:   { gates_passed: 19, gates_total: 20, must_failed: 0, tier: "TIER_2" },
      results: [{ gate_key: "slippage_realistic", passed: false, reason: "no slippage model" }],
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
  });

  it("does NOT call computeGates when the algorithm is already live (no re-check friction)", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "live" } });
    const res = await POST(makeRequest(), CTX);
    expect(computeGatesMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("happy path: approved algorithm with all gates passing deploys successfully", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "approved" } });
    computeGatesMock.mockResolvedValue({
      score:   { gates_passed: 20, gates_total: 20, must_failed: 0, tier: "TIER_1" },
      results: [],
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
  });
});
