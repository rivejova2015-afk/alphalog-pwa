// Unit tests for POST /api/cme/connect.
//
// Covers the 7 failure branches + 1 happy path of the Tradovate connect
// handler. Until now the endpoint had no dedicated coverage; the only adjacent
// tests live in `src/lib/cme/__tests__/tradovate.test.ts` and exercise the
// REST client, not the route handler.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const {
  getUserMock, userFromMock, svcFromMock, tradovateAuthMock, getAccountsMock,
  storeTokenMock, auditMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  userFromMock:       vi.fn(),
  svcFromMock:        vi.fn(),
  tradovateAuthMock:  vi.fn(),
  getAccountsMock:    vi.fn(),
  storeTokenMock:     vi.fn(),
  auditMock:          vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: userFromMock,
  }),
  createServiceClient: () => ({ from: svcFromMock }),
}));
vi.mock("@/lib/cme/tradovate", () => ({
  tradovateAuth: tradovateAuthMock,
  getAccounts:   getAccountsMock,
}));
vi.mock("@/lib/cme/vault", () => ({
  storeCmeAccessToken: storeTokenMock,
}));
vi.mock("@/lib/security/auditLog", () => ({
  logAuditFromRequest: auditMock,
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    headers: new Headers(),
  } as unknown as NextRequest;
}

/** Chainable Supabase query stub. Returns the given result for `.maybeSingle()` or `.single()`. */
function singleChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve(result);
  proxy.single      = () => Promise.resolve(result);
  return proxy;
}

/** Chainable Supabase upsert stub. `select(...).single()` returns the given result. */
function upsertChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.upsert = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  proxy.eq     = () => proxy;
  return proxy;
}

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const validBody = {
  cmeAccountId: VALID_UUID,
  tradovateUsername: "alice",
  tradovatePassword: "secret",
};

function authedUser(id = "user-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } } });
}

function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null } });
}

function setOwnedAccount(opts: { is_paper?: boolean; provider_name?: string; account_number?: string } = {}) {
  userFromMock.mockImplementation((table: string) => {
    if (table === "algo_cme_accounts") {
      return singleChain({
        data: {
          id: VALID_UUID,
          is_paper: opts.is_paper ?? true,
          provider_name: opts.provider_name ?? "TopstepX",
          account_number: opts.account_number ?? "TS-12345",
        },
        error: null,
      });
    }
    return singleChain({ data: null, error: null });
  });
}

function setAccountNotFound() {
  userFromMock.mockImplementation(() => singleChain({ data: null, error: null }));
}

function setSvcUpsertOk(connectionId = "conn-1") {
  svcFromMock.mockImplementation((table: string) => {
    if (table === "cme_connections") return upsertChain({ data: { id: connectionId }, error: null });
    if (table === "cme_risk_configs") return upsertChain({ data: null, error: null });
    return upsertChain({ data: null, error: null });
  });
}

function setSvcConnectionInsertFails() {
  svcFromMock.mockImplementation((table: string) => {
    if (table === "cme_connections") return upsertChain({ data: null, error: { message: "duplicate key" } });
    return upsertChain({ data: null, error: null });
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/cme/connect", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    userFromMock.mockReset();
    svcFromMock.mockReset();
    tradovateAuthMock.mockReset();
    getAccountsMock.mockReset();
    storeTokenMock.mockReset();
    auditMock.mockReset();
  });

  it("401 when not authenticated", async () => {
    unauthed();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("400 on validation failure (missing fields)", async () => {
    authedUser();
    const res = await POST(makeRequest({ cmeAccountId: "not-a-uuid" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined(); // Zod flattened issues
  });

  it("400 on null body (json parse failure)", async () => {
    authedUser();
    const res = await POST({
      json: async () => { throw new Error("invalid json"); },
      headers: new Headers(),
    } as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("404 when cmeAccountId doesn't belong to the user", async () => {
    authedUser();
    setAccountNotFound();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Account not found");
  });

  it("502 when tradovateAuth rejects (invalid credentials)", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockRejectedValue(new Error("Invalid Tradovate credentials"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/Tradovate auth failed/);
    expect(json.error).toMatch(/Invalid Tradovate credentials/);
  });

  it("502 when getAccounts rejects (broker API down)", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockRejectedValue(new Error("503 Service Unavailable"));
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toMatch(/Could not fetch Tradovate accounts/);
  });

  it("422 when no matching Tradovate account is returned by getAccounts", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([]); // empty accounts array
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe("No Tradovate account found for this user");
  });

  it("500 when cme_connections upsert fails", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([{ id: 42, name: "TS-12345" }]);
    setSvcConnectionInsertFails();
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to save connection");
  });

  it("200 with success + connectionId + tradovateAccountId on happy path", async () => {
    authedUser("user-42");
    setOwnedAccount({ is_paper: true, account_number: "TS-12345" });
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([
      { id: 42, name: "TS-12345" },
      { id: 99, name: "OTHER" },
    ]);
    setSvcUpsertOk("conn-99");

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      connectionId: "conn-99",
      tradovateAccountId: 42,
      tradovateAccountName: "TS-12345",
    });
  });

  it("stores access token via vault helper on success", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-abc", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([{ id: 42, name: "TS-12345" }]);
    setSvcUpsertOk("conn-99");

    await POST(makeRequest(validBody));
    expect(storeTokenMock).toHaveBeenCalledWith("conn-99", "tok-abc");
  });

  it("upserts cme_risk_configs with defaults on first connect", async () => {
    authedUser();
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([{ id: 42, name: "TS-12345" }]);

    const upsertCalls: { table: string; row: Record<string, unknown> }[] = [];
    svcFromMock.mockImplementation((table: string) => {
      const proxy: Record<string, unknown> = {};
      proxy.upsert = (row: Record<string, unknown>) => {
        upsertCalls.push({ table, row });
        return proxy;
      };
      proxy.select = () => proxy;
      proxy.single = () => Promise.resolve(table === "cme_connections" ? { data: { id: "conn-1" }, error: null } : { data: null, error: null });
      return proxy;
    });

    await POST(makeRequest(validBody));
    const riskCfg = upsertCalls.find((c) => c.table === "cme_risk_configs");
    expect(riskCfg).toBeDefined();
    expect(riskCfg!.row).toMatchObject({ enabled: true, circuit_breaker_pct: 80 });
  });

  it("writes an audit log entry on success", async () => {
    authedUser("user-7");
    setOwnedAccount();
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([{ id: 42, name: "TS-12345" }]);
    setSvcUpsertOk("conn-99");

    await POST(makeRequest(validBody));
    expect(auditMock).toHaveBeenCalledTimes(1);
    const [auditPayload] = auditMock.mock.calls[0];
    expect(auditPayload).toMatchObject({
      userId: "user-7",
      action: "api_call",
      resourceType: "account",
      status: "success",
      changes: expect.objectContaining({ cme_account_id: VALID_UUID, tradovate_account_id: 42 }),
    });
  });

  it("passes is_paper from the cme_accounts row to tradovateAuth", async () => {
    authedUser();
    setOwnedAccount({ is_paper: false });
    tradovateAuthMock.mockResolvedValue({ accessToken: "tok-1", expirationTime: "2099-01-01T00:00:00Z" });
    getAccountsMock.mockResolvedValue([{ id: 42, name: "TS-12345" }]);
    setSvcUpsertOk();

    await POST(makeRequest(validBody));
    expect(tradovateAuthMock).toHaveBeenCalled();
    const [, isPaperArg] = tradovateAuthMock.mock.calls[0];
    expect(isPaperArg).toBe(false);
  });
});
