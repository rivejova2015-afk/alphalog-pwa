// Integration test for /api/algorithms/[id]/control POST handler.
//
// Endpoint inserts a pause|resume bot_commands row that the Fly bot's
// CommandPoller picks up in ≤30s. Covers:
//   1. 401 when unauthenticated.
//   2. 400 when body is invalid JSON.
//   3. 400 when action is not 'pause'|'resume'.
//   4. 404 when no active deployment exists.
//   5. 404 when deployment belongs to a different user (RLS guard).
//   6. 500 when deployment is missing bot_id (orphaned).
//   7. 500 when bot_commands insert errors.
//   8. Happy path: returns the inserted command + audit log call fires.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  serviceFromMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserMock:     vi.fn(),
  serviceFromMock: vi.fn(),
  logAuditMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
  createServiceClient: () => ({ from: serviceFromMock }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));
vi.mock("@/lib/security/auditLog", () => ({
  logAuditFromRequest: logAuditMock,
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

function makeRequest(body: unknown | "INVALID_JSON" = { action: "pause" }): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/control", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    body === "INVALID_JSON" ? "{ not valid" : JSON.stringify(body),
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

describe("/api/algorithms/[id]/control — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    serviceFromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 400 when the body is invalid JSON", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await POST(makeRequest("INVALID_JSON"), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 when action is not pause|resume", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const res = await POST(makeRequest({ action: "stop" }), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 404 when no active deployment exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({ data: null, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/No active deployment/i);
  });

  it("returns 404 when the deployment owner doesn't match user (RLS guard)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   { bot_id: "bot-1" },
          algorithms:     { user_id: "OTHER", market_type: "crypto", name: "x" },
        },
        error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns 500 when deployment is missing bot_id (orphan)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   null,
          algorithms:     { user_id: "u1", market_type: "crypto", name: "x" },
        },
        error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/missing bot_id/i);
  });

  it("returns 500 when bot_commands insert errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   { bot_id: "bot-1" },
          algorithms:     { user_id: "u1", market_type: "crypto", name: "x" },
        },
        error: null,
      });
      if (table === "bot_commands") return makeAwaitableChain({ data: null, error: { message: "constraint violation" } });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to dispatch/i);
  });

  it("happy path: returns the inserted pause command + logs audit", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   { bot_id: "bot-1" },
          algorithms:     { user_id: "u1", market_type: "crypto", name: "Test" },
        },
        error: null,
      });
      if (table === "bot_commands") return makeAwaitableChain({
        data: {
          id: "cmd-1",
          command_type: "pause",
          status: "pending",
          created_at: "2026-06-12T10:00:00Z",
        },
        error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest({ action: "pause" }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.command).toMatchObject({ id: "cmd-1", command_type: "pause", status: "pending" });
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      action: "update",
      resourceType: "algorithm",
      resourceId: "algo-1",
    });
  });
});
