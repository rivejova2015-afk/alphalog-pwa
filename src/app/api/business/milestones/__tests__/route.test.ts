// Integration tests for /api/business/milestones GET + POST.
//
// Covers:
//   1. GET 401 unauth.
//   2. GET success: returns milestones[] ordered by target_date + Cache-Control.
//   3. GET supabase error: 500.
//   4. POST 401 unauth.
//   5. POST 400 JSON inválido.
//   6. POST 400 title vacío.
//   7. POST success: insert + audit log + 201.
//   8. POST defaults: description='', target_date=null, status='pending'.
//   9. POST insert error: 500 + 'Create failed'.

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
  return new NextRequest("http://localhost/api/business/milestones", {
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

describe("GET /api/business/milestones", () => {
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

  it("Success: returns milestones[] + Cache-Control", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: [
        { id: "m1", title: "Launch v2", status: "pending" },
        { id: "m2", title: "Reach $100k", status: "in_progress" },
      ],
      error: null,
    }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.milestones).toHaveLength(2);
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("Supabase error: 500 + 'Fetch failed'", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({
      data: null, error: { message: "db down" },
    }));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/business/milestones", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ title: "X" }));
    expect(res.status).toBe(401);
  });

  it("400 JSON inválido", async () => {
    authedUser();
    const req = new NextRequest("http://localhost/api/business/milestones", {
      method: "POST", body: "{ broken",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400 cuando title vacío", async () => {
    authedUser();
    const res = await POST(makeRequest({ title: "" }));
    expect(res.status).toBe(400);
  });

  it("Success: insert + audit log + 201", async () => {
    authedUser("u-1");
    let captured: unknown = null;
    fromMock.mockReturnValue(makeInsertChain(
      { data: { id: "m-new", title: "Launch v2", status: "pending" }, error: null },
      (p) => { captured = p; },
    ));

    const res = await POST(makeRequest({
      title: "Launch v2",
      description: "Ship the new dashboard",
      target_date: "2026-09-01",
      status: "pending",
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.milestone.id).toBe("m-new");
    expect((captured as Record<string, unknown>).user_id).toBe("u-1");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        action: "create",
        resourceType: "business_milestone",
        resourceId: "m-new",
        status: "success",
      }),
      expect.anything(),
    );
  });

  it("Defaults aplicados: description='', target_date=null, goal_id=null, notes=null", async () => {
    authedUser("u-1");
    let captured: Record<string, unknown> = {};
    fromMock.mockReturnValue(makeInsertChain(
      { data: { id: "m-1", title: "x" }, error: null },
      (p) => { captured = p as Record<string, unknown>; },
    ));

    // Submit only required field
    await POST(makeRequest({ title: "Min milestone" }));

    expect(captured.description).toBe("");
    expect(captured.target_date).toBeNull();
    expect(captured.goal_id).toBeNull();
    expect(captured.notes).toBeNull();
  });

  it("Insert error: 500 + 'Create failed'", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({
      data: null, error: { message: "FK violation" },
    }));

    const res = await POST(makeRequest({ title: "X" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Create failed");
  });

  it("goal_id uuid inválido → 400 (schema rechaza)", async () => {
    authedUser();
    const res = await POST(makeRequest({
      title: "X", goal_id: "not-a-uuid",
    }));
    expect(res.status).toBe(400);
  });
});
