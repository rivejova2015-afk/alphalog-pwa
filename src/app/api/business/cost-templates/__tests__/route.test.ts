// Integration tests for /api/business/cost-templates GET + POST handlers.
//
// Alimenta el cron mensual de costos recurrentes (/api/cron/business/recurring-costs)
// — importa que day_of_month/start_month/active viajen bien al insert.

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
let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
  POST = mod.POST;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }, captureInsert?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { captureInsert?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(opts: { method: string; body?: unknown; raw?: string }): NextRequest {
  return new NextRequest("http://localhost/api/business/cost-templates", {
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

const VALID_TEMPLATE_BODY = {
  amount: 25,
  category: "Data",
  description: "Bloomberg terminal",
  vendor: "Bloomberg",
  day_of_month: 15,
  start_month: "2026-07",
  active: true,
};

describe("GET /api/business/cost-templates", () => {
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

  it("Success: retorna templates[]", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: [{ id: "tpl-1", vendor: "Bloomberg" }], error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(1);
  });
});

describe("POST /api/business/cost-templates", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ method: "POST", body: VALID_TEMPLATE_BODY }));
    expect(res.status).toBe(401);
  });

  it("400 cuando day_of_month fuera de rango (32)", async () => {
    authedUser();
    const res = await POST(makeRequest({ method: "POST", body: { ...VALID_TEMPLATE_BODY, day_of_month: 32 } }));
    expect(res.status).toBe(400);
  });

  it("400 cuando start_month no matchea YYYY-MM", async () => {
    authedUser();
    const res = await POST(makeRequest({ method: "POST", body: { ...VALID_TEMPLATE_BODY, start_month: "07-2026" } }));
    expect(res.status).toBe(400);
  });

  it("Success: insert con day_of_month/start_month/active correctos + audit log", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeInsertChain(
      { data: { id: "tpl-new", ...VALID_TEMPLATE_BODY }, error: null },
      (p) => { captured = p; },
    ));

    const res = await POST(makeRequest({ method: "POST", body: VALID_TEMPLATE_BODY }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.template.id).toBe("tpl-new");

    const payload = captured as Record<string, unknown>;
    expect(payload.user_id).toBe("u-1");
    expect(payload.day_of_month).toBe(15);
    expect(payload.start_month).toBe("2026-07");
    expect(payload.active).toBe(true);

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "create", resourceType: "business_cost_template", resourceId: "tpl-new" }),
      expect.anything(),
    );
  });

  it("500 cuando el insert falla", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({ data: null, error: { message: "insert boom" } }));
    const res = await POST(makeRequest({ method: "POST", body: VALID_TEMPLATE_BODY }));
    expect(res.status).toBe(500);
  });
});
