// Integration tests for /api/business/sops GET + POST.
//
// Covers:
//   1. GET 401 unauth.
//   2. GET success: sops[] con items[] joined por sop_id.
//   3. GET supabase error (sops): 500.
//   4. GET Cache-Control header presente.
//   5. POST 401 unauth.
//   6. POST 400 JSON inválido.
//   7. POST 400 title vacío.
//   8. POST 400 type fuera del enum.
//   9. POST success: insert SOP + items + audit + 201.
//   10. POST con items vacíos: solo SOP insertado.
//   11. POST SOP insert error: 500.
//   12. POST items insert error: returns SOP sin items (no falla la req).

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
  for (const m of methods) proxy[m] = vi.fn(() => proxy);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertSingleChain(result: { data?: unknown; error?: unknown }, capture?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { capture?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeInsertManyChain(result: { data?: unknown; error?: unknown }, capture?: (p: unknown) => void) {
  // Items insertion: .insert(rows).select() — terminal awaitable, no .single()
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { capture?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(body?: unknown, raw?: string): NextRequest {
  return new NextRequest("http://localhost/api/business/sops", {
    method: "POST",
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    headers: { "Content-Type": "application/json" },
  });
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/sops", () => {
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

  it("Success: sops[] con items[] joined", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeSelectChain({
          data: [
            { id: "s1", title: "Pre-session", sort_index: 0 },
            { id: "s2", title: "Post-session", sort_index: 1 },
          ],
          error: null,
        });
      }
      if (table === "business_sop_items") {
        return makeSelectChain({
          data: [
            { id: "i1", sop_id: "s1", label: "Check news", sort_index: 0 },
            { id: "i2", sop_id: "s1", label: "Set risk", sort_index: 1 },
            { id: "i3", sop_id: "s2", label: "Log trades", sort_index: 0 },
          ],
          error: null,
        });
      }
      return makeSelectChain({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sops).toHaveLength(2);
    expect(body.sops[0].items).toHaveLength(2);
    expect(body.sops[1].items).toHaveLength(1);
    expect(body.sops[0].items[0].label).toBe("Check news");
  });

  it("Supabase error en sops: 500 + 'Fetch failed'", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeSelectChain({ data: null, error: { message: "rls denied" } });
      }
      return makeSelectChain({ data: [], error: null });
    });

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Fetch failed");
  });

  it("Cache-Control header presente en GET success", async () => {
    authedUser();
    fromMock.mockReturnValue(makeSelectChain({ data: [], error: null }));
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });

  it("Items huérfanos (sop_id no en sops): no aparecen en output", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeSelectChain({
          data: [{ id: "s1", title: "X", sort_index: 0 }],
          error: null,
        });
      }
      if (table === "business_sop_items") {
        return makeSelectChain({
          data: [
            { id: "i1", sop_id: "s1", label: "A" },
            { id: "i9", sop_id: "ghost", label: "Orphan" },
          ],
          error: null,
        });
      }
      return makeSelectChain({ data: [], error: null });
    });

    const res = await GET();
    const body = await res.json();
    expect(body.sops).toHaveLength(1);
    expect(body.sops[0].items).toHaveLength(1);
    expect(body.sops[0].items[0].label).toBe("A");
  });
});

describe("POST /api/business/sops", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ title: "x", type: "pre_session" }));
    expect(res.status).toBe(401);
  });

  it("400 JSON inválido", async () => {
    authedUser();
    const res = await POST(makeRequest(undefined, "{ broken"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("400 title vacío", async () => {
    authedUser();
    const res = await POST(makeRequest({ title: "", type: "pre_session" }));
    expect(res.status).toBe(400);
  });

  it("400 type fuera del enum", async () => {
    authedUser();
    const res = await POST(makeRequest({ title: "x", type: "not_a_real_type" }));
    expect(res.status).toBe(400);
  });

  it("Success: insert SOP + items + audit + 201", async () => {
    authedUser("u-1");
    let sopCaptured: Record<string, unknown> = {};
    let itemsCaptured: unknown = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeInsertSingleChain(
          { data: { id: "s-new", title: "Pre-session", type: "pre_session", content: "" }, error: null },
          (p) => { sopCaptured = p as Record<string, unknown>; },
        );
      }
      if (table === "business_sop_items") {
        return makeInsertManyChain(
          { data: [
            { id: "i-1", sop_id: "s-new", label: "Item 1", sort_index: 0 },
            { id: "i-2", sop_id: "s-new", label: "Item 2", sort_index: 1 },
          ], error: null },
          (p) => { itemsCaptured = p; },
        );
      }
      return makeInsertSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({
      title: "Pre-session",
      type: "pre_session",
      content: "Daily ritual",
      items: [{ label: "Item 1" }, { label: "Item 2" }],
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sop.id).toBe("s-new");
    expect(body.sop.items).toHaveLength(2);
    expect(sopCaptured.user_id).toBe("u-1");
    expect(sopCaptured.content).toBe("Daily ritual");

    // Items insertion got user_id + sop_id + sort_index per row
    const rows = itemsCaptured as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].user_id).toBe("u-1");
    expect(rows[0].sop_id).toBe("s-new");
    expect(rows[0].sort_index).toBe(0);
    expect(rows[1].sort_index).toBe(1);

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        action: "create",
        resourceType: "business_sop",
        resourceId: "s-new",
        status: "success",
        changes: expect.objectContaining({ item_count: 2 }),
      }),
      expect.anything(),
    );
  });

  it("POST sin items: solo SOP insertado", async () => {
    authedUser("u-1");
    let timesInserted = 0;
    fromMock.mockImplementation((table: string) => {
      timesInserted++;
      if (table === "business_sops") {
        return makeInsertSingleChain(
          { data: { id: "s-new", title: "x", type: "weekly_close" }, error: null },
        );
      }
      // Should NOT be called for items
      return makeInsertSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({
      title: "Weekly close",
      type: "weekly_close",
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sop.items).toEqual([]);
    expect(timesInserted).toBe(1); // only sops insert
  });

  it("POST SOP insert error: 500", async () => {
    authedUser("u-1");
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeInsertSingleChain({ data: null, error: { message: "constraint" } });
      }
      return makeInsertSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ title: "x", type: "custom" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Create failed");
  });

  it("POST items insert error: returns SOP sin items (no falla la req)", async () => {
    authedUser("u-1");
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeInsertSingleChain(
          { data: { id: "s-new", title: "x", type: "custom" }, error: null },
        );
      }
      if (table === "business_sop_items") {
        return makeInsertManyChain({
          data: null, error: { message: "items unique violation" },
        });
      }
      return makeInsertSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({
      title: "x",
      type: "custom",
      items: [{ label: "A" }],
    }));

    // Still 201 — SOP created, items failed gracefully
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sop.id).toBe("s-new");
    expect(body.sop.items).toEqual([]);
  });
});
