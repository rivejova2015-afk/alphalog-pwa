// Integration tests for /api/business/costs GET + POST handlers.
//
// Covers:
//   1. GET 401 cuando auth falla.
//   2. GET success: returns costs[] + Cache-Control header.
//   3. GET con month filter: aplica gte/lte sobre cost_date.
//   4. GET con month inválido (no YYYY-MM): NO aplica filter.
//   5. GET supabase error: 500 + logError.
//   6. POST 401 cuando auth falla.
//   7. POST 400 cuando JSON inválido.
//   8. POST 400 cuando payload viola schema (amount negativo, category bad).
//   9. POST success: insert + audit log + 201 con cost en body.
//   10. POST supabase insert error: 500 + bug recorded.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, logAuditMock, recordBugMock } = vi.hoisted(() => ({
  getUserMock:   vi.fn(),
  fromMock:      vi.fn(),
  logAuditMock:  vi.fn(),
  recordBugMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/auditLog", () => ({
  logAuditFromRequest: logAuditMock,
}));
vi.mock("@/lib/security/bugRecorder", () => ({
  recordBugFromRequest: recordBugMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET  = mod.GET;
  POST = mod.POST;
});

// Chain builder for SELECT (terminal await): from.select.eq.is.order [+gte+lte]
function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order", "gte", "lte"];
  for (const m of methods) {
    proxy[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return proxy; };
  }
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  (proxy as { _calls: typeof calls })._calls = calls;
  return proxy;
}

// Chain builder for INSERT (terminal via .single()): from.insert.select.single
function makeInsertChain(result: { data?: unknown; error?: unknown }, captureInsert?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { captureInsert?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(opts: {
  method: string; body?: unknown; query?: string;
}): NextRequest {
  const url = `http://localhost/api/business/costs${opts.query ? "?" + opts.query : ""}`;
  return new NextRequest(url, {
    method: opts.method,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/costs", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
    recordBugMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("Success: returns costs[] + Cache-Control header", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: [{ id: "c1", amount: 100, category: "Data" }],
      error: null,
    }));

    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.costs).toHaveLength(1);
    expect(body.costs[0].id).toBe("c1");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("month filter válido: aplica gte/lte sobre cost_date", async () => {
    authedUser();
    let chainProxy: ReturnType<typeof makeSelectChain> | null = null;
    fromMock.mockImplementation(() => {
      chainProxy = makeSelectChain({ data: [], error: null });
      return chainProxy;
    });

    await GET(makeRequest({ method: "GET", query: "month=2026-06" }));
    const calls = (chainProxy as unknown as { _calls: Array<{ method: string; args: unknown[] }> })?._calls ?? [];
    const gteCall = calls.find((c) => c.method === "gte");
    const lteCall = calls.find((c) => c.method === "lte");
    expect(gteCall?.args).toEqual(["cost_date", "2026-06-01"]);
    expect(lteCall?.args).toEqual(["cost_date", "2026-06-31"]);
  });

  it("month inválido (no YYYY-MM): NO aplica filter", async () => {
    authedUser();
    let chainProxy: ReturnType<typeof makeSelectChain> | null = null;
    fromMock.mockImplementation(() => {
      chainProxy = makeSelectChain({ data: [], error: null });
      return chainProxy;
    });

    await GET(makeRequest({ method: "GET", query: "month=not-a-date" }));
    const calls = (chainProxy as unknown as { _calls: Array<{ method: string; args: unknown[] }> })?._calls ?? [];
    expect(calls.find((c) => c.method === "gte")).toBeUndefined();
    expect(calls.find((c) => c.method === "lte")).toBeUndefined();
  });

  it("supabase error: 500 + 'Fetch failed'", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { message: "rls denied" },
    }));

    const res = await GET(makeRequest({ method: "GET" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Fetch failed");
  });
});

describe("POST /api/business/costs", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
    recordBugMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ method: "POST", body: { amount: 100 } }));
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON body inválido", async () => {
    authedUser();
    const req = new NextRequest("http://localhost/api/business/costs", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("400 cuando schema violation (amount negativo)", async () => {
    authedUser();
    const res = await POST(makeRequest({
      method: "POST",
      body: {
        amount: -100,
        category: "Data",
        description: "AWS",
        vendor: "Amazon",
        cost_date: "2026-06-15",
      },
    }));
    expect(res.status).toBe(400);
  });

  it("400 cuando category fuera del enum permitido", async () => {
    authedUser();
    const res = await POST(makeRequest({
      method: "POST",
      body: {
        amount: 100,
        category: "Marketing", // NOT in enum
        description: "Ads",
        vendor: "Google",
        cost_date: "2026-06-15",
      },
    }));
    expect(res.status).toBe(400);
  });

  it("Success: insert + audit log + 201 con cost en body", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeInsertChain(
      { data: {
        id: "c-new", amount: 250, category: "Tools Software",
        vendor: "GitHub", cost_date: "2026-06-15",
      }, error: null },
      (p) => { captured = p; },
    ));

    const res = await POST(makeRequest({
      method: "POST",
      body: {
        amount: 250,
        category: "Tools Software",
        description: "Pro subscription",
        vendor: "GitHub",
        cost_date: "2026-06-15",
      },
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.cost.id).toBe("c-new");
    // user_id is injected by handler
    expect((captured as Record<string, unknown>).user_id).toBe("u-1");
    expect((captured as Record<string, unknown>).is_recurring_instance).toBe(false);
    expect((captured as Record<string, unknown>).template_id).toBeNull();

    // audit log
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        action: "create",
        resourceType: "business_cost",
        resourceId: "c-new",
        status: "success",
      }),
      expect.anything(),
    );
  });

  it("Insert error: 500 + bug recorded", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({
      data: null, error: { message: "unique violation" },
    }));

    const res = await POST(makeRequest({
      method: "POST",
      body: {
        amount: 100,
        category: "Data",
        description: "Bloomberg",
        vendor: "Bloomberg",
        cost_date: "2026-06-15",
      },
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Create failed");
    expect(recordBugMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "u-1",
        status: 500,
        error: "unique violation",
      }),
    );
  });
});
