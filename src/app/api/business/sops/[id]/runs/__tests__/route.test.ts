// Integration tests for /api/business/sops/[id]/runs GET + POST.
//
// Covers:
//   - GET: 401, 500 (fetch runs falla), success con runs+items joined, success
//     sin runs (no consulta business_sop_run_items).
//   - POST: 401, 404 (SOP ajeno), body vacío tolerado (default run_date=hoy),
//     clona business_sop_items actuales → business_sop_run_items (snapshot),
//     success sin items del SOP (run se crea igual, sin run_items).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, logAuditMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/auditLog", () => ({ logAuditFromRequest: logAuditMock }));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

type RouteParams = { params: Promise<{ id: string }> };
let GET: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
let POST: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
  POST = mod.POST;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order", "limit", "in"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeOwnershipChain(found: boolean) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve({ data: found ? { id: "s-1" } : null, error: null });
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown; raw?: string }): NextRequest {
  return new NextRequest("http://localhost/api/business/sops/s-1/runs", {
    method: opts.method,
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id = "s-1"): RouteParams {
  return { params: Promise.resolve({ id }) };
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/sops/[id]/runs", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(401);
  });

  it("500 cuando falla el fetch de runs", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: null, error: { message: "rls denied" } }));
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(500);
  });

  it("Success sin runs: NO consulta business_sop_run_items", async () => {
    authedUser();
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      return makeSelectChain({ data: [], error: null });
    });
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toEqual([]);
    expect(calls).not.toContain("business_sop_run_items");
  });

  it("Success con runs: retorna runs con items joined por run_id", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sop_runs") {
        return makeSelectChain({ data: [{ id: "run-1" }, { id: "run-2" }], error: null });
      }
      return makeSelectChain({
        data: [
          { id: "ri-1", run_id: "run-1", checked: false },
          { id: "ri-2", run_id: "run-2", checked: true },
        ],
        error: null,
      });
    });
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(2);
    expect(body.runs.find((r: { id: string }) => r.id === "run-1").items).toHaveLength(1);
    expect(body.runs.find((r: { id: string }) => r.id === "run-2").items).toHaveLength(1);
  });
});

describe("POST /api/business/sops/[id]/runs", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ method: "POST", body: {} }), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando el SOP no es del usuario", async () => {
    authedUser();
    fromMock.mockReturnValue(makeOwnershipChain(false));
    const res = await POST(makeRequest({ method: "POST", body: {} }), ctx());
    expect(res.status).toBe(404);
  });

  it("Body vacío es tolerado: usa run_date=hoy por default", async () => {
    authedUser("u-1");
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      if (table === "business_sops") return makeOwnershipChain(true);
      if (table === "business_sop_items") return makeSelectChain({ data: [], error: null });
      return makeInsertChain({ data: { id: "run-new", run_date: new Date().toISOString().slice(0, 10) }, error: null });
    });
    const req = new NextRequest("http://localhost/api/business/sops/s-1/runs", { method: "POST" });
    const res = await POST(req, ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.run.run_date).toBe(new Date().toISOString().slice(0, 10));
  });

  it("Success: clona business_sop_items → business_sop_run_items (snapshot)", async () => {
    authedUser("u-1");
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") return makeOwnershipChain(true);
      if (table === "business_sop_items") {
        return makeSelectChain({ data: [{ id: "item-1" }, { id: "item-2" }], error: null });
      }
      if (table === "business_sop_runs") {
        return makeInsertChain({ data: { id: "run-new", run_date: "2026-07-06" }, error: null });
      }
      // business_sop_run_items insert
      return makeInsertChain({
        data: [
          { id: "ri-1", run_id: "run-new", item_id: "item-1", checked: false },
          { id: "ri-2", run_id: "run-new", item_id: "item-2", checked: false },
        ],
        error: null,
      });
    });

    const res = await POST(makeRequest({ method: "POST", body: { run_date: "2026-07-06" } }), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.run.id).toBe("run-new");
    expect(body.run.items).toHaveLength(2);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create", resourceType: "business_sop", resourceId: "run-new",
        changes: expect.objectContaining({ item_count: 2 }),
      }),
      expect.anything(),
    );
  });

  it("Success sin items del SOP: run se crea igual, con items=[]", async () => {
    authedUser("u-1");
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") return makeOwnershipChain(true);
      if (table === "business_sop_items") return makeSelectChain({ data: [], error: null });
      return makeInsertChain({ data: { id: "run-new", run_date: "2026-07-06" }, error: null });
    });
    const res = await POST(makeRequest({ method: "POST", body: { run_date: "2026-07-06" } }), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.run.items).toEqual([]);
  });
});
