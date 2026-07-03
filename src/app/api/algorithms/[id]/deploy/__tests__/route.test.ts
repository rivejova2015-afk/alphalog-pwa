// Integration test for /api/algorithms/[id]/deploy POST handler (Wave 3 item
// 12 — this endpoint moves an algorithm into 'live' and had zero coverage
// despite being one of the highest-risk routes in the app).
//
// Covers: 401, 429 (rate limit 10/hr), 400 (invalid body), 404 (algorithm
// not found), 409 (status not approved/live), 403 (bot_account not owned),
// 500 (upsert error), happy path (upsert + status=live + audit log).

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
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "upsert", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

function makeRequest(body: unknown = { bot_account_ids: [VALID_UUID] }): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/deploy", {
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
}

function setupFromDispatch(opts: {
  algo?: { id: string; status: string; platform?: string | null } | null;
  ownedAccounts?: { id: string }[];
  upsertError?: { message: string } | null;
}) {
  const {
    algo = { id: "algo-1", status: "approved", platform: "MT4" },
    ownedAccounts = [{ id: VALID_UUID }],
    upsertError = null,
  } = opts;

  fromMock.mockImplementation((table: string) => {
    if (table === "algorithms") return makeAwaitableChain({ data: algo, error: null });
    if (table === "bot_accounts") return makeAwaitableChain({ data: ownedAccounts, error: null });
    if (table === "algorithm_deployments") {
      return makeAwaitableChain({
        data: upsertError ? null : [{ id: "dep-1", bot_account_id: VALID_UUID, status: "active" }],
        error: upsertError,
      });
    }
    return makeAwaitableChain({ data: null, error: null });
  });
}

describe("/api/algorithms/[id]/deploy — POST", () => {
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

  it("returns 429 when rate limit exceeded", async () => {
    setupAuth(false);
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
  });

  it("returns 400 on invalid body (empty bot_account_ids)", async () => {
    setupAuth();
    const res = await POST(makeRequest({ bot_account_ids: [] }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 when bot_account_ids contains a non-UUID string", async () => {
    setupAuth();
    const res = await POST(makeRequest({ bot_account_ids: ["not-a-uuid"] }), CTX);
    expect(res.status).toBe(400);
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
    setupFromDispatch({ ownedAccounts: [] });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(403);
  });

  it("returns 500 when the algorithm_deployments upsert errors", async () => {
    setupAuth();
    setupFromDispatch({ upsertError: { message: "rls denied" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls denied");
  });

  it("happy path: upserts deployment, marks algorithm live, audits", async () => {
    setupAuth();
    setupFromDispatch({});
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deployments).toHaveLength(1);
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      action: "create",
      resourceType: "algorithm_deployment",
      resourceId: "algo-1",
      status: "success",
    });
  });

  it("happy path: an already-live algorithm can also deploy (adding accounts)", async () => {
    setupAuth();
    setupFromDispatch({ algo: { id: "algo-1", status: "live" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
  });
});
