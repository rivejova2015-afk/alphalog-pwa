// Integration tests for /api/business/decisions/[id] GET + PUT + DELETE handlers.
//
// Covers:
//   1. GET 401 cuando auth falla.
//   2. GET 404 cuando la decision no existe.
//   3. GET success: retorna decision + tasks (Promise.all, cache header).
//   4. GET 500 cuando falla el fetch de la decision.
//   5. PUT 401 / 400 (JSON inválido) / 404 / success.
//   6. DELETE 401 / 404 / success — soft-delete cascadea a business_decision_tasks.

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
let PUT: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
let DELETE: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
  PUT = mod.PUT;
  DELETE = mod.DELETE;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve(result);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeUpdateChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["update", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown } = { method: "GET" }): NextRequest {
  return new NextRequest("http://localhost/api/business/decisions/d-1", {
    method: opts.method,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id = "d-1"): RouteParams {
  return { params: Promise.resolve({ id }) };
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/decisions/[id]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando la decision no existe", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "business_decisions"
        ? makeSelectChain({ data: null, error: null })
        : makeSelectChain({ data: [], error: null })
    );
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it("500 cuando falla el fetch de la decision", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "business_decisions"
        ? makeSelectChain({ data: null, error: { message: "rls denied" } })
        : makeSelectChain({ data: [], error: null })
    );
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(500);
  });

  it("Success: retorna decision + tasks joined, con Cache-Control", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "business_decisions"
        ? makeSelectChain({ data: { id: "d-1", title: "Migrar a Fly" }, error: null })
        : makeSelectChain({ data: [{ id: "t-1", title: "Paso 1", done: false }], error: null })
    );
    const res = await GET(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.id).toBe("d-1");
    expect(body.tasks).toHaveLength(1);
    expect(res.headers.get("Cache-Control")).toContain("private");
  });
});

describe("PUT /api/business/decisions/[id]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await PUT(makeRequest({ method: "PUT", body: { title: "x" } }), ctx());
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const req = new NextRequest("http://localhost/api/business/decisions/d-1", {
      method: "PUT", body: "not-json", headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando la decision no existe (update no afecta filas)", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const res = await PUT(makeRequest({ method: "PUT", body: { title: "Nuevo título" } }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: actualiza y registra audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateChain({ data: { id: "d-1", title: "Nuevo título" }, error: null }));
    const res = await PUT(makeRequest({ method: "PUT", body: { title: "Nuevo título" } }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.title).toBe("Nuevo título");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "update", resourceType: "business_decision", resourceId: "d-1" }),
      expect.anything(),
    );
  });
});

describe("DELETE /api/business/decisions/[id]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando la decision no existe", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateChain({ error: null, count: 0 }));
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: soft-delete de la decision Y cascada a business_decision_tasks", async () => {
    authedUser("u-1");
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      return makeUpdateChain({ error: null, count: 1 });
    });
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(calls).toContain("business_decisions");
    expect(calls).toContain("business_decision_tasks");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", resourceType: "business_decision", resourceId: "d-1" }),
      expect.anything(),
    );
  });
});
