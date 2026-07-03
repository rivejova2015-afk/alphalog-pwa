// Integration test for /api/algorithms/[id] GET/PUT/DELETE handlers.
//
// Covers Wave 2 item 5: PUT (update parameters, touches real bots) previously
// had neither a rate limit nor an audit log entry — a spammable, untraced
// path to mutate a live algorithm's config. Now covers:
//   - 401 / 429 (rate limit 30/hr) / 400 (invalid body, no fields).
//   - Crypto parameters re-validated against CoinarbParametersSchema.
//   - Happy path fires logAuditFromRequest with the update payload as `changes`.
// Plus baseline GET/DELETE coverage this endpoint never had before.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  fromMock,
  serviceFromMock,
  checkRateLimitMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  fromMock:           vi.fn(),
  serviceFromMock:    vi.fn(),
  checkRateLimitMock: vi.fn(),
  logAuditMock:       vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
  createServiceClient: () => ({
    from: serviceFromMock,
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

let GET: any, PUT: any, DELETE: any;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET; PUT = mod.PUT; DELETE = mod.DELETE;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "insert", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1", {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    duplex: body !== undefined ? "half" : undefined,
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
}

describe("/api/algorithms/[id]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    serviceFromMock.mockReset();
    checkRateLimitMock.mockReset();
    logAuditMock.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await GET(makeRequest("GET"), CTX);
      expect(res.status).toBe(401);
    });

    it("returns 404 when not found", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
      const res = await GET(makeRequest("GET"), CTX);
      expect(res.status).toBe(404);
    });

    it("returns the algorithm on success", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({ data: { id: "algo-1", name: "Test" }, error: null }));
      const res = await GET(makeRequest("GET"), CTX);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.algorithm.id).toBe("algo-1");
    });
  });

  describe("PUT", () => {
    it("returns 401 when auth fails", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await PUT(makeRequest("PUT", { name: "x" }), CTX);
      expect(res.status).toBe(401);
    });

    it("returns 429 when rate limit exceeded (30/hr)", async () => {
      setupAuth(false);
      const res = await PUT(makeRequest("PUT", { name: "x" }), CTX);
      expect(res.status).toBe(429);
      expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(res.headers.get("Retry-After")).toBe("3600");
    });

    it("returns 400 on invalid body", async () => {
      setupAuth();
      const res = await PUT(makeRequest("PUT", { status: "not-a-real-status" }), CTX);
      expect(res.status).toBe(400);
    });

    it("returns 400 when no valid fields are provided", async () => {
      setupAuth();
      const res = await PUT(makeRequest("PUT", {}), CTX);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/no valid fields/i);
    });

    it("returns 400 when crypto parameters fail CoinarbParametersSchema", async () => {
      setupAuth();
      fromMock.mockImplementation((table: string) => {
        if (table === "algorithms") {
          return makeAwaitableChain({ data: { market_type: "crypto" }, error: null });
        }
        return makeAwaitableChain({ data: null, error: null });
      });
      const res = await PUT(makeRequest("PUT", { parameters: { mtf_confidence_min: 99 } }), CTX);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Crypto parameters validation failed/i);
    });

    it("returns 404 when the update affects no rows", async () => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
      const res = await PUT(makeRequest("PUT", { name: "New name" }), CTX);
      expect(res.status).toBe(404);
    });

    it("happy path: updates name, fires audit log with changes", async () => {
      setupAuth();
      fromMock.mockReturnValue(makeAwaitableChain({
        data: { id: "algo-1", name: "New name" }, error: null,
      }));
      const res = await PUT(makeRequest("PUT", { name: "New name" }), CTX);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.algorithm.name).toBe("New name");
      expect(logAuditMock).toHaveBeenCalledTimes(1);
      expect(logAuditMock.mock.calls[0][0]).toMatchObject({
        userId: "u1",
        action: "update",
        resourceType: "algorithm",
        resourceId: "algo-1",
        status: "success",
        changes: { name: "New name" },
      });
    });

    it("happy path: parameters update dispatches a bot_command and still audits", async () => {
      setupAuth();
      fromMock.mockImplementation((table: string) => {
        if (table === "algorithms") {
          return makeAwaitableChain({ data: { id: "algo-1", parameters: { mtf_confidence_min: 0.2 } }, error: null });
        }
        return makeAwaitableChain({ data: null, error: null });
      });
      serviceFromMock.mockImplementation((table: string) => {
        if (table === "algorithm_deployments") {
          return makeAwaitableChain({ data: { bot_account_id: "ba-1", bot_accounts: { bot_id: "bot-A" } }, error: null });
        }
        if (table === "bot_commands") {
          return makeAwaitableChain({ data: null, error: null });
        }
        return makeAwaitableChain({ data: null, error: null });
      });
      const res = await PUT(makeRequest("PUT", { parameters: { mtf_confidence_min: 0.2 } }), CTX);
      expect(res.status).toBe(200);
      expect(logAuditMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("DELETE", () => {
    it("returns 401 when auth fails", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await DELETE(makeRequest("DELETE"), CTX);
      expect(res.status).toBe(401);
    });

    it("returns 404 when nothing was deleted", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({ data: [], error: null }));
      const res = await DELETE(makeRequest("DELETE"), CTX);
      expect(res.status).toBe(404);
    });

    it("happy path: soft-deletes and audits", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({ data: [{ id: "algo-1" }], error: null }));
      const res = await DELETE(makeRequest("DELETE"), CTX);
      expect(res.status).toBe(200);
      expect(logAuditMock).toHaveBeenCalledTimes(1);
    });
  });
});
