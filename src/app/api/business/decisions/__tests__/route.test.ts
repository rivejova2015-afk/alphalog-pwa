// Integration tests for /api/business/decisions GET + POST.
//
// Covers:
//   1. GET 401 unauth.
//   2. GET success: returns decisions[] + Cache-Control header.
//   3. GET supabase error: 500.
//   4. POST 401 unauth.
//   5. POST 400 JSON inválido.
//   6. POST 400 schema violation (title vacío, decision vacía).
//   7. POST success: insert + audit log + 201 con decision en body.
//   8. POST insert error: 500.
//   9. POST con defaults: tags=[], priority='med', context/rationale=''.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, logAuditMock } = vi.hoisted(() => ({
  getUserMock:  vi.fn(),
  fromMock:     vi.fn(),
  logAuditMock: vi.fn(),
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
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: () => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET  = mod.GET;
  POST = mod.POST;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order"];
  for (const m of methods) {
    proxy[m] = vi.fn(() => proxy);
  }
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }, capture?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { capture?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/business/decisions", {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/decisions", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("Success: returns decisions[] + Cache-Control header", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: [
        { id: "d1", title: "Stop XAUUSD", priority: "high" },
        { id: "d2", title: "Add review cadence", priority: "med" },
      ],
      error: null,
    }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decisions).toHaveLength(2);
    expect(body.decisions[0].id).toBe("d1");
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("Supabase error: 500 + 'Fetch failed'", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { message: "rls denied" },
    }));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Fetch failed");
  });
});

describe("POST /api/business/decisions", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ title: "x", decision: "y" }));
    expect(res.status).toBe(401);
  });

  it("400 JSON inválido", async () => {
    authedUser();
    const req = new NextRequest("http://localhost/api/business/decisions", {
      method: "POST", body: "{ broken json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("400 cuando title vacío", async () => {
    authedUser();
    const res = await POST(makeRequest({ title: "", decision: "Reduce gold" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando decision vacía", async () => {
    authedUser();
    const res = await POST(makeRequest({ title: "Strategy review", decision: "" }));
    expect(res.status).toBe(400);
  });

  it("Success: insert + audit log + 201 con decision en body", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeInsertChain(
      { data: { id: "d-new", title: "Pause XAUUSD", priority: "high" }, error: null },
      (p) => { captured = p; },
    ));

    const res = await POST(makeRequest({
      title: "Pause XAUUSD",
      decision: "Stop trading until Monday",
      rationale: "Volatility too high",
      priority: "high",
      tags: ["risk"],
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.decision.id).toBe("d-new");
    expect((captured as Record<string, unknown>).user_id).toBe("u-1");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        action: "create",
        resourceType: "business_decision",
        resourceId: "d-new",
        status: "success",
      }),
      expect.anything(),
    );
  });

  it("Insert error: 500 + 'Create failed'", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({
      data: null, error: { message: "constraint violation" },
    }));

    const res = await POST(makeRequest({
      title: "x", decision: "y",
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Create failed");
  });

  it("Defaults aplicados: tags=[], priority='med', context/rationale=''", async () => {
    authedUser("u-1");
    let captured: Record<string, unknown> = {};
    fromMock.mockReturnValue(makeInsertChain(
      { data: { id: "d-1", title: "x" }, error: null },
      (p) => { captured = p as Record<string, unknown>; },
    ));

    // Only required fields submitted
    await POST(makeRequest({ title: "Min decision", decision: "Y" }));

    expect(captured.tags).toEqual([]);
    expect(captured.priority).toBe("med");
    expect(captured.context).toBe("");
    expect(captured.rationale).toBe("");
  });
});
