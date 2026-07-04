// Integration tests for /api/business/decisions/[id]/tasks GET + POST + PATCH + DELETE.
//
// Covers:
//   - GET/POST comparten `ensureDecisionOwnership` (business_decisions lookup) —
//     ambos 404 cuando la decision no es del usuario.
//   - PATCH/DELETE dispatchan por `?taskId=` query param (no path param) — 400
//     cuando falta, scoping por decision_id+user_id en la query (no hay un
//     segundo ownership-check separado, a diferencia de GET/POST).

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
let PATCH: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
let DELETE: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
  POST = mod.POST;
  PATCH = mod.PATCH;
  DELETE = mod.DELETE;
});

// business_decisions ownership check chain: select().eq().eq().is().maybeSingle()
function makeOwnershipChain(found: boolean) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve({ data: found ? { id: "d-1" } : null });
  return proxy;
}

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
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

function makeRequest(opts: { method: string; body?: unknown; query?: string }): NextRequest {
  const url = `http://localhost/api/business/decisions/d-1/tasks${opts.query ? "?" + opts.query : ""}`;
  return new NextRequest(url, {
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

describe("GET /api/business/decisions/[id]/tasks", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando la decision no es del usuario (ensureDecisionOwnership)", async () => {
    authedUser();
    fromMock.mockReturnValue(makeOwnershipChain(false));
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: retorna tasks[] ordenadas", async () => {
    authedUser();
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeOwnershipChain(true);
      return makeSelectChain({ data: [{ id: "t1", title: "Paso 1" }], error: null });
    });
    const res = await GET(makeRequest({ method: "GET" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
  });
});

describe("POST /api/business/decisions/[id]/tasks", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ method: "POST", body: { title: "x" } }), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando la decision no es del usuario", async () => {
    authedUser();
    fromMock.mockReturnValue(makeOwnershipChain(false));
    const res = await POST(makeRequest({ method: "POST", body: { title: "x" } }), ctx());
    expect(res.status).toBe(404);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    fromMock.mockReturnValue(makeOwnershipChain(true));
    const req = new NextRequest("http://localhost/api/business/decisions/d-1/tasks", {
      method: "POST", body: "not-json", headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(400);
  });

  it("400 cuando title vacío (schema violation)", async () => {
    authedUser();
    fromMock.mockReturnValue(makeOwnershipChain(true));
    const res = await POST(makeRequest({ method: "POST", body: { title: "" } }), ctx());
    expect(res.status).toBe(400);
  });

  it("Success: insert + audit log + 201", async () => {
    authedUser("u-1");
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeOwnershipChain(true);
      return makeInsertChain({ data: { id: "t-new", title: "Nuevo paso", done: false }, error: null });
    });
    const res = await POST(makeRequest({ method: "POST", body: { title: "Nuevo paso" } }), ctx());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.task.id).toBe("t-new");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "create", resourceType: "business_decision" }),
      expect.anything(),
    );
  });
});

describe("PATCH /api/business/decisions/[id]/tasks", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await PATCH(makeRequest({ method: "PATCH", body: { done: true } }), ctx());
    expect(res.status).toBe(401);
  });

  it("400 cuando falta ?taskId=", async () => {
    authedUser();
    const res = await PATCH(makeRequest({ method: "PATCH", body: { done: true } }), ctx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("taskId");
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const req = new NextRequest("http://localhost/api/business/decisions/d-1/tasks?taskId=t-1", {
      method: "PATCH", body: "not-json", headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(req, ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando el task no existe / no pertenece a esta decision+usuario", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const res = await PATCH(makeRequest({ method: "PATCH", query: "taskId=t-1", body: { done: true } }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: actualiza done + audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateChain({ data: { id: "t-1", done: true }, error: null }));
    const res = await PATCH(makeRequest({ method: "PATCH", query: "taskId=t-1", body: { done: true } }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.done).toBe(true);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", resourceType: "business_decision", resourceId: "t-1" }),
      expect.anything(),
    );
  });
});

describe("DELETE /api/business/decisions/[id]/tasks", () => {
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

  it("400 cuando falta ?taskId=", async () => {
    authedUser();
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando el task no existe", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateChain({ error: null, count: 0 }));
    const res = await DELETE(makeRequest({ method: "DELETE", query: "taskId=t-1" }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: soft-delete + audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateChain({ error: null, count: 1 }));
    const res = await DELETE(makeRequest({ method: "DELETE", query: "taskId=t-1" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", resourceType: "business_decision", resourceId: "t-1" }),
      expect.anything(),
    );
  });
});
