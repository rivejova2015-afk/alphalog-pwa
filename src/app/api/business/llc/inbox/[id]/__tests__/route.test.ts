// Integration tests for /api/business/llc/inbox/[id] PUT + DELETE handlers.

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
  const methods = ["update", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown; raw?: string }): NextRequest {
  return new NextRequest("http://localhost/api/business/llc/inbox/i-1", {
    method: opts.method,
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id = "i-1"): RouteParams {
  return { params: Promise.resolve({ id }) };
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("PUT /api/business/llc/inbox/[id]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await PUT(makeRequest({ method: "PUT", body: { status: "resolved" } }), ctx());
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const res = await PUT(makeRequest({ method: "PUT", raw: "not-json" }), ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando el item no existe", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const res = await PUT(makeRequest({ method: "PUT", body: { status: "done" } }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: actualiza + audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateSingleChain({ data: { id: "i-1", status: "done" }, error: null }));
    const res = await PUT(makeRequest({ method: "PUT", body: { status: "done" } }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("done");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", resourceType: "business_llc", resourceId: "i-1" }),
      expect.anything(),
    );
  });
});

describe("DELETE /api/business/llc/inbox/[id]", () => {
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

  it("404 cuando el item no existe", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateCountChain({ error: null, count: 0 }));
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: soft-delete + audit log", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpdateCountChain({ error: null, count: 1 }));
    const res = await DELETE(makeRequest({ method: "DELETE" }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "delete", resourceType: "business_llc", resourceId: "i-1" }),
      expect.anything(),
    );
  });
});
