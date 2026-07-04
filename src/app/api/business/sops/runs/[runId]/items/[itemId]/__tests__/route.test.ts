// Integration tests for PATCH /api/business/sops/runs/[runId]/items/[itemId].
//
// Covers: 401, 400 (JSON inválido), 404 (item no encontrado), checked=true
// setea checked_at (branch condicional), checked=false lo limpia a null,
// note opcional se persiste sin tocar checked_at.

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

type RouteParams = { params: Promise<{ runId: string; itemId: string }> };
let PATCH: (req: NextRequest, ctx: RouteParams) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  PATCH = mod.PATCH;
});

function makeUpdateSingleChain(result: { data?: unknown; error?: unknown }, capturePatch?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.update = (p: unknown) => { capturePatch?.(p); return proxy; };
  proxy.eq = () => proxy;
  proxy.is = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(opts: { body?: unknown; raw?: string }): NextRequest {
  return new NextRequest("http://localhost/api/business/sops/runs/run-1/items/ri-1", {
    method: "PATCH",
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(runId = "run-1", itemId = "ri-1"): RouteParams {
  return { params: Promise.resolve({ runId, itemId }) };
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("PATCH /api/business/sops/runs/[runId]/items/[itemId]", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await PATCH(makeRequest({ body: { checked: true } }), ctx());
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const res = await PATCH(makeRequest({ raw: "not-json" }), ctx());
    expect(res.status).toBe(400);
  });

  it("404 cuando el run item no existe / no pertenece a este run+usuario", async () => {
    authedUser();
    fromMock.mockReturnValue(makeUpdateSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const res = await PATCH(makeRequest({ body: { checked: true } }), ctx());
    expect(res.status).toBe(404);
  });

  it("checked=true setea checked_at a un timestamp", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeUpdateSingleChain(
      { data: { id: "ri-1", checked: true, checked_at: "2026-07-06T00:00:00.000Z" }, error: null },
      (p) => { captured = p; },
    ));
    const res = await PATCH(makeRequest({ body: { checked: true } }), ctx());
    expect(res.status).toBe(200);
    const patch = captured as Record<string, unknown>;
    expect(patch.checked).toBe(true);
    expect(patch.checked_at).toEqual(expect.any(String));
    expect(patch.checked_at).not.toBeNull();
  });

  it("checked=false limpia checked_at a null", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeUpdateSingleChain(
      { data: { id: "ri-1", checked: false, checked_at: null }, error: null },
      (p) => { captured = p; },
    ));
    const res = await PATCH(makeRequest({ body: { checked: false } }), ctx());
    expect(res.status).toBe(200);
    const patch = captured as Record<string, unknown>;
    expect(patch.checked).toBe(false);
    expect(patch.checked_at).toBeNull();
  });

  it("note opcional se persiste sin tocar checked_at", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeUpdateSingleChain(
      { data: { id: "ri-1", note: "listo, verificado" }, error: null },
      (p) => { captured = p; },
    ));
    const res = await PATCH(makeRequest({ body: { note: "listo, verificado" } }), ctx());
    expect(res.status).toBe(200);
    const patch = captured as Record<string, unknown>;
    expect(patch.note).toBe("listo, verificado");
    expect(patch.checked).toBeUndefined();
    expect(patch.checked_at).toBeUndefined();

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", resourceType: "business_sop", resourceId: "ri-1",
        changes: expect.objectContaining({ run_id: "run-1" }) }),
      expect.anything(),
    );
  });
});
