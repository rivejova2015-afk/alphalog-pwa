// Integration tests for /api/business/llc/inbox GET + POST handlers.

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
  return new NextRequest("http://localhost/api/business/llc/inbox", {
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

describe("GET /api/business/llc/inbox", () => {
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

  it("Success: retorna items[]", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: [{ id: "i-1", title: "IRS letter" }], error: null }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
  });
});

describe("POST /api/business/llc/inbox", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ method: "POST", body: { title: "x", received_on: "2026-07-01" } }));
    expect(res.status).toBe(401);
  });

  it("400 cuando JSON inválido", async () => {
    authedUser();
    const res = await POST(makeRequest({ method: "POST", raw: "not-json" }));
    expect(res.status).toBe(400);
  });

  it("400 cuando falta title (schema violation)", async () => {
    authedUser();
    const res = await POST(makeRequest({ method: "POST", body: { received_on: "2026-07-01" } }));
    expect(res.status).toBe(400);
  });

  it("Success: insert + audit log + 201", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({
      data: { id: "i-new", title: "IRS letter", received_on: "2026-07-01" }, error: null,
    }));
    const res = await POST(makeRequest({ method: "POST", body: { title: "IRS letter", received_on: "2026-07-01" } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.id).toBe("i-new");
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-1", action: "create", resourceType: "business_llc" }),
      expect.anything(),
    );
  });

  it("500 cuando el insert falla", async () => {
    authedUser("u-1");
    fromMock.mockReturnValue(makeInsertChain({ data: null, error: { message: "insert boom" } }));
    const res = await POST(makeRequest({ method: "POST", body: { title: "x", received_on: "2026-07-01" } }));
    expect(res.status).toBe(500);
  });
});
