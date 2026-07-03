// Integration test for /api/algorithms/[id]/audit-trail GET handler
// (Wave 5 item 23).
//
// Covers: 401, 404 (algorithm not found), 500 (query error), happy path
// (scoped to resource_type in [algorithm, algorithm_deployment] AND
// resource_id = algorithm id), empty list (no entries yet, still 200).

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
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/audit-trail", { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

describe("/api/algorithms/[id]/audit-trail — GET", () => {
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
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 500 when the audit_logs query errors", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1" }, error: null });
      return makeAwaitableChain({ data: null, error: { message: "rls denied" } });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
  });

  it("returns entries scoped to this algorithm", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1" }, error: null });
      return makeAwaitableChain({
        data: [
          { id: "log-1", action: "update", resource_type: "algorithm", changes: { status: "live" }, status: "success", error_message: null, created_at: "2026-07-01T00:00:00Z" },
          { id: "log-2", action: "create", resource_type: "algorithm_deployment", changes: null, status: "success", error_message: null, created_at: "2026-06-30T00:00:00Z" },
        ],
        error: null,
      });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].action).toBe("update");
  });

  it("returns an empty list (not an error) when nothing has been logged yet", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1" }, error: null });
      return makeAwaitableChain({ data: [], error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});
