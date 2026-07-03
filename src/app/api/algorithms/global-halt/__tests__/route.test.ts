// Integration test for /api/algorithms/global-halt (GET/POST/DELETE).
//
// Covers item 3 of Wave 1: the global kill-switch.
//   - GET returns current halted state.
//   - POST activates the halt, upserts global_trading_halt, and fans out
//     'pause' bot_commands to every unique bot_id with an active deployment.
//   - DELETE deactivates the halt but does NOT auto-resume bots (deliberate
//     safety choice — resuming everything at once after an incident is as
//     risky as the incident itself; the user must resume per-algorithm).

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GET: any, POST: any, DELETE: any;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET; POST = mod.POST; DELETE = mod.DELETE;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "insert", "update", "upsert"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/global-halt", {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    duplex: body !== undefined ? "half" : undefined,
  });
}

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 60 });
}

describe("/api/algorithms/global-halt", () => {
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
      const res = await GET(makeRequest("GET"));
      expect(res.status).toBe(401);
    });

    it("returns halted=false when no row exists yet", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
      const res = await GET(makeRequest("GET"));
      const body = await res.json();
      expect(body.halted).toBe(false);
    });

    it("returns halted=true with reason when active", async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      fromMock.mockReturnValue(makeAwaitableChain({
        data: { halted: true, halted_at: "2026-01-01T00:00:00Z", reason: "market crash" },
        error: null,
      }));
      const res = await GET(makeRequest("GET"));
      const body = await res.json();
      expect(body.halted).toBe(true);
      expect(body.reason).toBe("market crash");
    });
  });

  describe("POST (activate)", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await POST(makeRequest("POST", {}));
      expect(res.status).toBe(401);
    });

    it("returns 429 when rate limit exceeded", async () => {
      setupAuth(false);
      const res = await POST(makeRequest("POST", {}));
      expect(res.status).toBe(429);
    });

    it("upserts halted=true and dispatches pause to every unique bot_id", async () => {
      setupAuth();
      serviceFromMock.mockImplementation((table: string) => {
        if (table === "global_trading_halt") {
          return makeAwaitableChain({ data: null, error: null });
        }
        if (table === "algorithm_deployments") {
          // Two deployments sharing bot-A, one on bot-B — expect dedup to 2 unique bot_ids.
          return makeAwaitableChain({
            data: [
              { bot_accounts: { bot_id: "bot-A" } },
              { bot_accounts: { bot_id: "bot-A" } },
              { bot_accounts: { bot_id: "bot-B" } },
            ],
            error: null,
          });
        }
        if (table === "bot_commands") {
          return makeAwaitableChain({ data: null, error: null });
        }
        return makeAwaitableChain({ data: null, error: null });
      });

      const res = await POST(makeRequest("POST", { reason: "manual test halt" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.halted).toBe(true);
      expect(body.bots_paused).toBe(2);
      expect(logAuditMock).toHaveBeenCalledTimes(1);
      expect(logAuditMock.mock.calls[0][0]).toMatchObject({
        userId: "u1",
        resourceType: "algorithm",
        resourceId: "global-halt",
      });
    });

    it("returns bots_paused=0 when there are no active deployments", async () => {
      setupAuth();
      serviceFromMock.mockImplementation((table: string) => {
        if (table === "algorithm_deployments") return makeAwaitableChain({ data: [], error: null });
        return makeAwaitableChain({ data: null, error: null });
      });
      const res = await POST(makeRequest("POST", {}));
      const body = await res.json();
      expect(body.bots_paused).toBe(0);
    });
  });

  describe("DELETE (resume)", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
      const res = await DELETE(makeRequest("DELETE"));
      expect(res.status).toBe(401);
    });

    it("sets halted=false but does NOT dispatch any bot_commands (deliberate — per-algorithm resume required)", async () => {
      setupAuth();
      serviceFromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
      const res = await DELETE(makeRequest("DELETE"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.halted).toBe(false);
      // 'bot_commands' table should never be touched by DELETE.
      const calledTables = serviceFromMock.mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).not.toContain("bot_commands");
    });
  });
});
