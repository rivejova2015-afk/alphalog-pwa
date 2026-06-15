// Integration test for /api/algorithms/[id]/promote-to-live POST handler.
//
// Endpoint runs the tier-1 quality gates and flips status='live' only when
// all 20 gates pass. Covers:
//   1. 401 when unauthenticated.
//   2. 429 when rate limit exceeded (5/hr).
//   3. 404 when the algorithm is not found.
//   4. 409 when already in 'live' status (idempotency guard).
//   5. 403 when must_failed > 0 → returns failed gates list.
//   6. 403 when gates_passed < 20.
//   7. 500 when the UPDATE to status='live' errors.
//   8. Happy path: returns the updated algorithm + audit log fires.

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
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "insert", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/promote-to-live", { method: "POST" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
}

describe("/api/algorithms/[id]/promote-to-live — handler", () => {
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
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("5");
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 409 when the algorithm is already live (idempotency guard)", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "x", status: "live" }, error: null,
    }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ya está en estado live/i);
    expect(computeGatesMock).not.toHaveBeenCalled();
  });

  it("returns 403 with failed gates when must_failed > 0", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "x", status: "approved" }, error: null,
    }));
    computeGatesMock.mockResolvedValue({
      score:   { gates_passed: 18, must_failed: 2, tier: "tier-1" },
      results: [
        { gate_key: "min_trades",  passed: false, reason: "only 5 trades" },
        { gate_key: "min_sharpe",  passed: false, reason: "sharpe 0.3 < 1" },
        { gate_key: "win_rate",    passed: true,  reason: null },
      ],
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Tier-1 quality gates/i);
    expect(body.failed).toHaveLength(2);
    expect(body.failed[0].gate_key).toBe("min_trades");
    expect(body.score.must_failed).toBe(2);
  });

  it("returns 403 when gates_passed < 20 even if must_failed == 0", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "x", status: "approved" }, error: null,
    }));
    computeGatesMock.mockResolvedValue({
      score:   { gates_passed: 19, must_failed: 0, tier: "tier-1" },
      results: [{ gate_key: "should_diversity", passed: false, reason: "single instrument" }],
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 500 when the UPDATE to live errors", async () => {
    setupAuth();
    computeGatesMock.mockResolvedValue({
      score: { gates_passed: 20, must_failed: 0, tier: "tier-1" },
      results: [],
    });
    // First .from() call: SELECT algo (returns approved). Second: UPDATE (errors).
    const calls: number[] = [];
    fromMock.mockImplementation(() => {
      calls.push(calls.length);
      if (calls.length === 1) {
        return makeAwaitableChain({ data: { id: "algo-1", name: "x", status: "approved" }, error: null });
      }
      return makeAwaitableChain({ data: null, error: { message: "rls denied" } });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls denied");
  });

  it("happy path: gates all pass → status=live, audit logged", async () => {
    setupAuth();
    computeGatesMock.mockResolvedValue({
      score: { gates_passed: 20, must_failed: 0, tier: "tier-1" },
      results: [],
    });
    const calls: number[] = [];
    fromMock.mockImplementation(() => {
      calls.push(calls.length);
      if (calls.length === 1) {
        return makeAwaitableChain({ data: { id: "algo-1", name: "x", status: "approved" }, error: null });
      }
      return makeAwaitableChain({
        data: { id: "algo-1", name: "x", status: "live" },
        error: null,
      });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm.status).toBe("live");
    expect(body.score.gates_passed).toBe(20);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      action: "update",
      resourceType: "algorithm",
      resourceId: "algo-1",
    });
  });
});
