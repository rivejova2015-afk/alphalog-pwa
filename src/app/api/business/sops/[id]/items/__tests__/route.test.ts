// Integration tests for POST /api/business/sops/[id]/items.
// Appends a checklist item to an existing SOP (sort_index = max+1).
//
// Covers:
//   1. 401 cuando auth falla.
//   2. 404 cuando SOP no encontrado (ownership / soft-deleted).
//   3. 400 JSON inválido.
//   4. 400 label vacío.
//   5. Success: insert con sort_index=(max+1) + audit + 201.
//   6. Si no hay items existentes (max=null): primer item sort_index=0.
//   7. Insert error: 500.

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

let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

const SOP_ID = "s-1";
const CTX = { params: Promise.resolve({ id: SOP_ID }) };

// Generic SELECT chain that ends in .maybeSingle()
function makeMaybeSingleChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "order", "limit"];
  for (const m of methods) proxy[m] = vi.fn(() => proxy);
  proxy.maybeSingle = () => Promise.resolve(result);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }, capture?: (p: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (p: unknown) => { capture?.(p); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(body?: unknown, raw?: string): NextRequest {
  return new NextRequest(`http://localhost/api/business/sops/${SOP_ID}/items`, {
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

describe("POST /api/business/sops/[id]/items", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    logAuditMock.mockReset();
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await POST(makeRequest({ label: "Item A" }), CTX);
    expect(res.status).toBe(401);
  });

  it("404 cuando SOP no encontrado (ownership / soft-deleted)", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeMaybeSingleChain({ data: null, error: null });
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ label: "Item A" }), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("SOP not found");
  });

  it("400 JSON inválido (después de SOP ownership check)", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeMaybeSingleChain({ data: { id: SOP_ID }, error: null });
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest(undefined, "{ broken"), CTX);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("400 label vacío", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) => {
      if (table === "business_sops") {
        return makeMaybeSingleChain({ data: { id: SOP_ID }, error: null });
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ label: "" }), CTX);
    expect(res.status).toBe(400);
  });

  it("Success: insert con sort_index = max+1 + audit + 201", async () => {
    authedUser("u-1");
    let captured: Record<string, unknown> = {};
    let call = 0;

    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === "business_sops") {
        // SOP ownership check
        return makeMaybeSingleChain({ data: { id: SOP_ID }, error: null });
      }
      if (call === 2 && table === "business_sop_items") {
        // Max sort_index query
        return makeMaybeSingleChain({ data: { sort_index: 4 }, error: null });
      }
      if (call === 3 && table === "business_sop_items") {
        // INSERT
        return makeInsertChain(
          { data: { id: "i-new", sop_id: SOP_ID, label: "Item C", sort_index: 5 }, error: null },
          (p) => { captured = p as Record<string, unknown>; },
        );
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ label: "Item C" }), CTX);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.id).toBe("i-new");

    // sort_index incremented from 4 → 5
    expect(captured.sort_index).toBe(5);
    expect(captured.sop_id).toBe(SOP_ID);
    expect(captured.user_id).toBe("u-1");
    expect(captured.label).toBe("Item C");

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u-1",
        action: "create",
        resourceType: "business_sop",
        resourceId: "i-new",
        status: "success",
        changes: expect.objectContaining({ sop_id: SOP_ID, label: "Item C" }),
      }),
      expect.anything(),
    );
  });

  it("Primer item (max=null): sort_index=0", async () => {
    authedUser("u-1");
    let captured: Record<string, unknown> = {};
    let call = 0;

    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === "business_sops") {
        return makeMaybeSingleChain({ data: { id: SOP_ID }, error: null });
      }
      if (call === 2 && table === "business_sop_items") {
        // No existing items
        return makeMaybeSingleChain({ data: null, error: null });
      }
      if (call === 3 && table === "business_sop_items") {
        return makeInsertChain(
          { data: { id: "i-first", sop_id: SOP_ID, label: "First", sort_index: 0 }, error: null },
          (p) => { captured = p as Record<string, unknown>; },
        );
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    await POST(makeRequest({ label: "First" }), CTX);
    expect(captured.sort_index).toBe(0);
  });

  it("Insert error: 500 + 'Create failed'", async () => {
    authedUser("u-1");
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === "business_sops") {
        return makeMaybeSingleChain({ data: { id: SOP_ID }, error: null });
      }
      if (call === 2 && table === "business_sop_items") {
        return makeMaybeSingleChain({ data: null, error: null });
      }
      if (call === 3 && table === "business_sop_items") {
        return makeInsertChain({ data: null, error: { message: "fk violation" } });
      }
      return makeMaybeSingleChain({ data: null, error: null });
    });

    const res = await POST(makeRequest({ label: "X" }), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Create failed");
  });
});
