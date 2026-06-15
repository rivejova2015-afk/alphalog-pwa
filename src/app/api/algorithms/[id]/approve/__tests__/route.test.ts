// Integration test for /api/algorithms/[id]/approve POST handler.
//
// Endpoint flips status='paper' → 'approved' after manual review. Covers:
//   1. 401 when unauthenticated.
//   2. 429 when rate limit exceeded (10/hr).
//   3. 404 when the algorithm is not found.
//   4. 409 when status is NOT 'paper' (draft, approved, live, paused).
//   5. 500 when the UPDATE errors.
//   6. Happy path: status='approved' + audit log fires.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  fromMock,
  checkRateLimitMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  fromMock:           vi.fn(),
  checkRateLimitMock: vi.fn(),
  logAuditMock:       vi.fn(),
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
  const chainable = ["select", "eq", "is", "single", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/approve", { method: "POST" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
}

describe("/api/algorithms/[id]/approve — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    checkRateLimitMock.mockReset();
    logAuditMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded with the right headers", async () => {
    setupAuth(false);
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no encontrado/i);
  });

  it.each(["draft", "approved", "live", "paused"])(
    "returns 409 when current status is %s (must be 'paper')",
    async (status) => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({
        data: { id: "algo-1", status }, error: null,
      }));
      const res = await POST(makeRequest(), CTX);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/Paper Test/i);
    },
  );

  it("returns 500 when the UPDATE to approved errors", async () => {
    setupAuth();
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: { id: "algo-1", status: "paper" }, error: null });
      return makeAwaitableChain({ data: null, error: { message: "rls denied" } });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls denied");
  });

  it("happy path: paper → approved + audit log fires", async () => {
    setupAuth();
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: { id: "algo-1", status: "paper" }, error: null });
      return makeAwaitableChain({
        data: { id: "algo-1", status: "approved", name: "Test" }, error: null,
      });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm.status).toBe("approved");
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      action: "update",
      resourceType: "algorithm",
      resourceId: "algo-1",
    });
  });
});
