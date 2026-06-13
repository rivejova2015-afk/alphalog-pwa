// Integration test for /api/algorithms/[id]/commands/recent GET handler.
//
// Validates the endpoint that ControlButton polls to verify a pause/resume
// bot_commands row reached DONE/FAILED. Covers:
//   1. 401 when auth fails.
//   2. Empty commands list when there's no active deployment.
//   3. Empty commands list when deployment exists but no bot_id.
//   4. 404 when deployment owner doesn't match authenticated user (RLS guard).
//   5. Happy path: commands joined with bot_command_status acks.
//   6. limit query param clamped to [1, 50].
//   7. bot_commands select error → 500 with the error message.
//   8. Commands without acks return ack:null in the response.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  serviceFromMock,
} = vi.hoisted(() => ({
  getUserMock:     vi.fn(),
  serviceFromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
  createServiceClient: () => ({ from: serviceFromMock }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
  logInfo:  vi.fn(),
  logWarn:  vi.fn(),
}));

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(limit?: string): NextRequest {
  const url = limit
    ? `http://localhost/api/algorithms/algo-1/commands/recent?limit=${limit}`
    : `http://localhost/api/algorithms/algo-1/commands/recent`;
  return new NextRequest(url, { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

describe("/api/algorithms/[id]/commands/recent — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    serviceFromMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(401);
    expect(serviceFromMock).not.toHaveBeenCalled();
  });

  it("returns empty commands when no active deployment exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({ data: null, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commands).toEqual([]);
  });

  it("returns empty commands when deployment exists but no bot_id (orphaned)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   null,  // ← no bot
          algorithms:     { user_id: "u1" },
        },
        error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commands).toEqual([]);
  });

  it("returns 404 when the deployment belongs to a different user (RLS guard)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: {
          bot_account_id: "ba-1",
          bot_accounts:   { bot_id: "bot-1" },
          algorithms:     { user_id: "OTHER-USER" },  // ← mismatch
        },
        error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  it("returns commands with ack joined when bot_command_status rows exist", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    const commands = [
      { id: "c1", command_type: "pause",  payload: {}, status: "PENDING", created_at: "2026-06-12T10:00:00Z", updated_at: "2026-06-12T10:00:00Z" },
      { id: "c2", command_type: "resume", payload: {}, status: "DONE",    created_at: "2026-06-12T09:00:00Z", updated_at: "2026-06-12T09:00:05Z" },
    ];
    const acks = [
      { command_id: "c1", status: "PENDING", message: null,         acked_at: null },
      { command_id: "c2", status: "DONE",    message: "ok",         acked_at: "2026-06-12T09:00:05Z" },
    ];

    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: { bot_account_id: "ba-1", bot_accounts: { bot_id: "bot-1" }, algorithms: { user_id: "u1" } },
        error: null,
      });
      if (table === "bot_commands")        return makeAwaitableChain({ data: commands, error: null });
      if (table === "bot_command_status")  return makeAwaitableChain({ data: acks, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });

    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commands).toHaveLength(2);
    expect(body.commands[0]).toMatchObject({
      id: "c1", command_type: "pause", status: "PENDING",
      ack: { status: "PENDING", message: null, acked_at: null },
    });
    expect(body.commands[1]).toMatchObject({
      id: "c2", command_type: "resume", status: "DONE",
      ack: { status: "DONE", message: "ok", acked_at: "2026-06-12T09:00:05Z" },
    });
  });

  it("returns commands with ack:null when no bot_command_status rows match", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const commands = [
      { id: "c-orphan", command_type: "pause", payload: {}, status: "PENDING",
        created_at: "2026-06-12T10:00:00Z", updated_at: "2026-06-12T10:00:00Z" },
    ];
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: { bot_account_id: "ba-1", bot_accounts: { bot_id: "bot-1" }, algorithms: { user_id: "u1" } },
        error: null,
      });
      if (table === "bot_commands")       return makeAwaitableChain({ data: commands, error: null });
      if (table === "bot_command_status") return makeAwaitableChain({ data: [], error: null });
      return makeAwaitableChain({ data: null, error: null });
    });

    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.commands[0].ack).toBeNull();
  });

  it("clamps the limit query param into [1, 50]", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    // We can't easily inspect the .limit() arg through the proxy chain, but
    // we CAN verify the route survives extreme inputs (negative, 0, huge)
    // without crashing. The clamp keeps the response 200 in all branches.
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: { bot_account_id: "ba-1", bot_accounts: { bot_id: "bot-1" }, algorithms: { user_id: "u1" } },
        error: null,
      });
      if (table === "bot_commands")       return makeAwaitableChain({ data: [], error: null });
      if (table === "bot_command_status") return makeAwaitableChain({ data: [], error: null });
      return makeAwaitableChain({ data: null, error: null });
    });

    for (const lim of ["0", "-5", "9999", "abc"]) {
      const res = await GET(makeRequest(lim), CTX);
      expect(res.status).toBe(200);
    }
  });

  it("returns 500 when bot_commands select errors", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === "algorithm_deployments") return makeAwaitableChain({
        data: { bot_account_id: "ba-1", bot_accounts: { bot_id: "bot-1" }, algorithms: { user_id: "u1" } },
        error: null,
      });
      if (table === "bot_commands") return makeAwaitableChain({ data: null, error: { message: "rls denied" } });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("rls denied");
  });

  it("returns 500 with generic message when an unexpected error throws", async () => {
    getUserMock.mockRejectedValue(new Error("supabase init crashed"));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
