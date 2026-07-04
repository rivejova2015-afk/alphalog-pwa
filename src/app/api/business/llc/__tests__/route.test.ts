// Integration tests for /api/business/llc GET + PUT.
//
// Covers:
//   - GET: 401, 500, sin fila existente retorna {llc: null}, success con fila.
//   - PUT: 401, 400 (JSON inválido / schema violation), success — usa upsert
//     con onConflict:"user_id" (path distinto a insert/update plano de otras
//     rutas), tanto para crear como para "actualizar" (mismo código en ambos casos).

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

let GET: () => Promise<Response>;
let PUT: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
  PUT = mod.PUT;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve(result);
  return proxy;
}

function makeUpsertChain(result: { data?: unknown; error?: unknown }, captureUpsert?: (p: unknown, opts: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.upsert = (p: unknown, opts: unknown) => { captureUpsert?.(p, opts); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown; raw?: string }): NextRequest {
  return new NextRequest("http://localhost/api/business/llc", {
    method: opts.method,
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    headers: { "Content-Type": "application/json" },
  });
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

const VALID_LLC_BODY = {
  llc_name: "AlphaLog LLC",
  annual_report_due_month: 3,
  annual_fee_baseline: 150,
};

describe("GET /api/business/llc", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("500 cuando falla el fetch", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: null, error: { message: "rls denied" } }));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("Sin fila existente retorna {llc: null}", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: null, error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llc).toBeNull();
  });

  it("Success con fila existente", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: { id: "llc-1", llc_name: "AlphaLog LLC" }, error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llc.llc_name).toBe("AlphaLog LLC");
  });
});

describe("PUT /api/business/llc", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await PUT(makeRequest({ method: "PUT", body: VALID_LLC_BODY }));
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const res = await PUT(makeRequest({ method: "PUT", raw: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta llc_name (schema violation)", async () => {
    authedUser();
    const res = await PUT(makeRequest({ method: "PUT", body: { annual_report_due_month: 3, annual_fee_baseline: 150 } }));
    expect(res.status).toBe(400);
  });

  it("Success: upsert con onConflict:'user_id' + audit log", async () => {
    authedUser("u-1");
    let capturedPayload: unknown = null;
    let capturedOpts: unknown = null;
    fromMock.mockReturnValue(makeUpsertChain(
      { data: { id: "llc-1", llc_name: "AlphaLog LLC", ein: null }, error: null },
      (p, opts) => { capturedPayload = p; capturedOpts = opts; },
    ));

    const res = await PUT(makeRequest({ method: "PUT", body: VALID_LLC_BODY }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.llc.llc_name).toBe("AlphaLog LLC");
    expect((capturedPayload as Record<string, unknown>).user_id).toBe("u-1");
    expect(capturedOpts).toEqual({ onConflict: "user_id" });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "update", resourceType: "business_llc" }),
      expect.anything(),
    );
  });

  it("500 cuando el upsert falla", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeUpsertChain({ data: null, error: { message: "constraint violation" } }));
    const res = await PUT(makeRequest({ method: "PUT", body: VALID_LLC_BODY }));
    expect(res.status).toBe(500);
  });
});
