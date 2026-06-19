// Integration tests for PATCH /api/treasury/payouts/status.
//
// Covers:
//   1. 401 cuando session falla.
//   2. 400 cuando payoutId falta.
//   3. 400 cuando status falta.
//   4. 400 cuando status NO está en ['planned', 'sent', 'received', 'canceled'].
//   5. 404 cuando payout no encontrado (RLS / no existe).
//   6. 500 cuando update Supabase falla.
//   7. Success: returns {success: true, payoutId, newStatus}.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { createServerClientMock, cookiesMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  cookiesMock:            vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let PATCH: (req: Request) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  PATCH = mod.PATCH;
});

type SupabaseFromHandler = (table: string) => unknown;
function makeSupabase(opts: {
  hasSession?: boolean;
  fromHandler?: SupabaseFromHandler;
} = {}) {
  const { hasSession = true, fromHandler } = opts;
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue(
        hasSession
          ? { data: { session: { user: { id: "u-1" } } }, error: null }
          : { data: { session: null }, error: { message: "no session" } }
      ),
    },
    from: fromHandler ?? vi.fn(),
  };
}

// SELECT chain for fetching payout to verify ownership
function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = vi.fn(() => proxy);
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

// UPDATE chain (terminal awaitable after eq's)
function makeUpdateChain(result: { error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.update = vi.fn(() => proxy);
  proxy.eq     = vi.fn(() => proxy);
  proxy.then   = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(body?: unknown, raw?: string): Request {
  return new Request("http://localhost/api/treasury/payouts/status", {
    method: "PATCH",
    body: raw ?? (body ? JSON.stringify(body) : "{}"),
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_PAYOUT_ID = "9c858901-8a57-4791-81c0-0c79c8500abf";

describe("PATCH /api/treasury/payouts/status", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({ getAll: () => [] });
  });

  it("401 cuando session falla", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({ hasSession: false }));
    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status: "sent" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("400 cuando payoutId falta", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({}));
    const res = await PATCH(makeRequest({ status: "sent" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("payoutId");
  });

  it("400 cuando status falta", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({}));
    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID }));
    expect(res.status).toBe(400);
  });

  it("400 cuando status NO está en el enum válido", async () => {
    createServerClientMock.mockReturnValue(makeSupabase({}));
    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status: "invalid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid status value");
  });

  it("404 cuando payout no encontrado", async () => {
    const fromHandler = vi.fn((_table: string) =>
      makeSelectChain({ data: null, error: { message: "no rows" } })
    );
    createServerClientMock.mockReturnValue(makeSupabase({ fromHandler }));

    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status: "sent" }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Payout not found");
  });

  it("500 cuando update Supabase falla", async () => {
    let call = 0;
    const fromHandler = vi.fn((_table: string) => {
      call++;
      if (call === 1) {
        return makeSelectChain({ data: { id: VALID_PAYOUT_ID, user_id: "u-1" }, error: null });
      }
      return makeUpdateChain({ error: { message: "update boom" } });
    });
    createServerClientMock.mockReturnValue(makeSupabase({ fromHandler }));

    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status: "sent" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to update status");
  });

  it("Success: returns {success:true, payoutId, newStatus}", async () => {
    let call = 0;
    const fromHandler = vi.fn((_table: string) => {
      call++;
      if (call === 1) {
        return makeSelectChain({ data: { id: VALID_PAYOUT_ID, user_id: "u-1" }, error: null });
      }
      return makeUpdateChain({ error: null });
    });
    createServerClientMock.mockReturnValue(makeSupabase({ fromHandler }));

    const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status: "received" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      payoutId: VALID_PAYOUT_ID,
      newStatus: "received",
    });
  });

  it("Success: cada status válido acepta ('planned'/'sent'/'received'/'canceled')", async () => {
    for (const status of ["planned", "sent", "received", "canceled"] as const) {
      let call = 0;
      const fromHandler = vi.fn((_table: string) => {
        call++;
        if (call === 1) {
          return makeSelectChain({ data: { id: VALID_PAYOUT_ID, user_id: "u-1" }, error: null });
        }
        return makeUpdateChain({ error: null });
      });
      createServerClientMock.mockReturnValue(makeSupabase({ fromHandler }));

      const res = await PATCH(makeRequest({ payoutId: VALID_PAYOUT_ID, status }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.newStatus).toBe(status);
    }
  });
});
