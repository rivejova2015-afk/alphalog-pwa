// Integration tests for /api/business/sops/[id] PUT + DELETE.
//
// Covers:
//   - PUT: 401, 400 (JSON inválido), 404 (update no afecta filas), success.
//   - DELETE: 401, 404, cascada de 4 tablas (sops → items → runs [lookup+update]
//     → run_items) cuando SÍ hay runs, y el guard de "sin runs" (no llama a
//     business_sop_runs/business_sop_run_items update) cuando NO hay runs —
//     este es el flujo de control más complejo del set de rutas de Business Hub.

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
let PUT: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
let DELETE: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  PUT = mod.PUT;
  DELETE = mod.DELETE;
});

function makeUpdateSingleChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["update", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeUpdateCountChain(result: { error?: unknown; count?: number }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["update", "eq", "is", "in"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown }): NextRequest {
  return new NextRequest("http://localhost/api/business/sops/s-1", {
    method: opts.method,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
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

describe("PUT /api/business/sops/[id]", () => {
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
    const req = new NextRequest("http://localhost/api/business/sops/s-1", {
      method: "PUT", body: "not-json", headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando el SOP no existe", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const res = await PUT(makeRequest({ method: "PUT", body: { title: "Nuevo título" } }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: actualiza + audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateSingleChain({ data: { id: "s-1", title: "Nuevo título" }, error: null }));
    const res = await PUT(makeRequest({ method: "PUT", body: { title: "Nuevo título" } }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sop.title).toBe("Nuevo título");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", resourceType: "business_sop", resourceId: "s-1" }),
      expect.anything(),
    );
  });
});

describe("DELETE /api/business/sops/[id]", () => {
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

  it("404 cuando el SOP no existe (count=0)", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateCountChain({ error: null, count: 0 }));
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success CON runs: cascada las 4 tablas (sops, items, runs lookup+update, run_items)", async () => {
    authedUser("u-1");
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      if (table === "business_sops") return makeUpdateCountChain({ error: null, count: 1 });
      if (table === "business_sop_items") return makeUpdateCountChain({ error: null, count: 3 });
      if (table === "business_sop_runs") {
        // First call in this table is the SELECT lookup, second is the UPDATE.
        const isSelect = !calls.slice(0, -1).includes("business_sop_runs");
        return isSelect
          ? makeSelectChain({ data: [{ id: "run-1" }, { id: "run-2" }], error: null })
          : makeUpdateCountChain({ error: null, count: 2 });
      }
      return makeUpdateCountChain({ error: null, count: 5 });
    });

    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(calls).toEqual(expect.arrayContaining([
      "business_sops", "business_sop_items", "business_sop_runs", "business_sop_run_items",
    ]));
  });

  it("Success SIN runs: NO toca business_sop_run_items (guard de vacío)", async () => {
    authedUser("u-1");
    const calls: string[] = [];
    fromMock.mockImplementation((table: string) => {
      calls.push(table);
      if (table === "business_sops") return makeUpdateCountChain({ error: null, count: 1 });
      if (table === "business_sop_items") return makeUpdateCountChain({ error: null, count: 0 });
      if (table === "business_sop_runs") return makeSelectChain({ data: [], error: null });
      return makeUpdateCountChain({ error: null, count: 0 });
    });

    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(200);
    expect(calls).not.toContain("business_sop_run_items");
  });
});
