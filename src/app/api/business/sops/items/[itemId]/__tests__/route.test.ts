// Integration tests for DELETE /api/business/sops/items/[itemId].
//
// Nota (ver comentario en route.ts): la ownership se verifica SOLO por
// user_id sobre business_sop_items, no por el SOP padre — el path es
// deliberadamente `/sops/items/[itemId]` en vez de `/sops/[id]/items/[itemId]`
// para que el panel pueda borrar sin conocer el SOP padre de antemano. Esto
// documenta el comportamiento actual con un test, no lo cambia — ambos SOPs
// (el "propio" y el de otro item) son siempre del mismo owner autenticado,
// así que no hay problema de autorización cross-user.

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

type RouteParams = { params: Promise<{ itemId: string }> };
let DELETE: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  DELETE = mod.DELETE;
});

function makeUpdateCountChain(result: { error?: unknown; count?: number }, captureFilters?: (calls: Array<{ method: string; args: unknown[] }>) => void) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const proxy: Record<string, unknown> = {};
  const methods = ["update", "eq", "is"];
  for (const m of methods) {
    proxy[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return proxy; };
  }
  proxy.then = (resolve: (v: unknown) => unknown) => { captureFilters?.(calls); return Promise.resolve(result).then(resolve); };
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/business/sops/items/item-1", { method: "DELETE" });
}

function ctx(itemId = "item-1"): RouteParams {
  return { params: Promise.resolve({ itemId }) };
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("DELETE /api/business/sops/items/[itemId]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(401);
  });

  it("404 cuando el item no existe o no es del usuario", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateCountChain({ error: null, count: 0 }));
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it("Success: soft-delete solo filtrando por id+user_id (NO por sop_id)", async () => {
    authedUser("u-1");
    let filters: Array<{ method: string; args: unknown[] }> = [];
    fromMock.mockReturnValue(makeUpdateCountChain({ error: null, count: 1 }, (calls) => { filters = calls; }));

    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const eqCalls = filters.filter((c) => c.method === "eq").map((c) => c.args[0]);
    expect(eqCalls).toContain("id");
    expect(eqCalls).toContain("user_id");
    expect(eqCalls).not.toContain("sop_id");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "delete", resourceType: "business_sop", resourceId: "item-1" }),
      expect.anything(),
    );
  });

  it("500 cuando falla el update", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateCountChain({ error: { message: "rls denied" } }));
    const res = await DELETE(makeRequest(), ctx());
    expect(res.status).toBe(500);
  });
});
