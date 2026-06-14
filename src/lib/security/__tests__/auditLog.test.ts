// Unit tests for src/lib/security/auditLog.ts.
//
// Audit-trail helper con chain-hash (HMAC SHA-256) por user_id + fallback
// path a app_logs cuando el RPC `log_audit_event` no existe. Validates:
//   - hashUserAgent: SHA-256 hex digest determinístico.
//   - logAuditEvent retorna null cuando faltan Supabase env vars.
//   - logAuditEvent retorna null cuando RPC retorna error genuino.
//   - logAuditEvent retorna RPC data (id) en happy path.
//   - logAuditEvent fallback a insert directo cuando RPC missing (PGRST202).
//   - logAuditEvent fallback final a app_logs cuando audit_logs insert también
//     falla.
//   - logAuditFromRequest extrae IP + UA hash de headers.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { createServerClientMock, rpcMock, fromMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  rpcMock:                vi.fn(),
  fromMock:               vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let hashUserAgent: typeof import("../auditLog").hashUserAgent;
let logAuditEvent: typeof import("../auditLog").logAuditEvent;
let logAuditFromRequest: typeof import("../auditLog").logAuditFromRequest;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.AUDIT_CHAIN_SECRET = "test-chain-secret";
  const mod = await import("../auditLog");
  hashUserAgent = mod.hashUserAgent;
  logAuditEvent = mod.logAuditEvent;
  logAuditFromRequest = mod.logAuditFromRequest;
});

function makeChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "not", "neq", "order", "limit"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.maybeSingle = () => Promise.resolve(result);
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

describe("hashUserAgent", () => {
  it("returns 64-char hex string (SHA-256 digest)", () => {
    const h = hashUserAgent("Mozilla/5.0 (Test)");
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it("es determinístico — same input → same hash", () => {
    expect(hashUserAgent("ua-fixed")).toBe(hashUserAgent("ua-fixed"));
  });

  it("inputs distintos producen hashes distintos (high entropy)", () => {
    expect(hashUserAgent("ua-a")).not.toBe(hashUserAgent("ua-b"));
  });
});

describe("logAuditEvent", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
  });

  it("returns null cuando NEXT_PUBLIC_SUPABASE_URL no está configurada", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const id = await logAuditEvent({ userId: "u1", action: "create", resourceType: "trade" });
    expect(id).toBeNull();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns null cuando RPC retorna error genuino (no missing)", async () => {
    createServerClientMock.mockReturnValue({
      rpc:  rpcMock.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } }),
      from: () => makeChain({ data: null, error: null }),  // chain_hash lookup
    });
    const id = await logAuditEvent({ userId: "u1", action: "create", resourceType: "trade" });
    expect(id).toBeNull();
  });

  it("happy path: RPC returns audit_log id → returned as-is", async () => {
    createServerClientMock.mockReturnValue({
      rpc:  rpcMock.mockResolvedValue({ data: "audit-row-uuid", error: null }),
      from: () => makeChain({ data: null, error: null }),
    });
    const id = await logAuditEvent({
      userId:       "u1",
      action:       "update",
      resourceType: "algorithm",
      resourceId:   "algo-1",
    });
    expect(id).toBe("audit-row-uuid");
    expect(rpcMock).toHaveBeenCalledWith("log_audit_event", expect.objectContaining({
      p_user_id:       "u1",
      p_action:        "update",
      p_resource_type: "algorithm",
      p_resource_id:   "algo-1",
    }));
  });

  it("RPC missing (PGRST202) → fallback insert directo a audit_logs", async () => {
    // Track call sequence: first audit_logs call is the chain-hash lookup
    // (returns null via maybeSingle), second is the fallback insert.
    let auditLogsCall = 0;
    createServerClientMock.mockReturnValue({
      rpc:  rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find function log_audit_event" } }),
      from: (table: string) => {
        if (table === "audit_logs") {
          auditLogsCall++;
          if (auditLogsCall === 1) return makeChain({ data: null, error: null });  // chain hash lookup
          return makeInsertChain({ data: { id: "fallback-row-1" }, error: null });  // fallback insert
        }
        return makeChain({ data: null, error: null });
      },
    });
    const id = await logAuditEvent({ userId: "u1", action: "create", resourceType: "trade" });
    expect(id).toBe("fallback-row-1");
  });

  it("Cuando RPC missing + audit_logs insert falla → fallback final a app_logs", async () => {
    let auditLogsCall = 0;
    createServerClientMock.mockReturnValue({
      rpc:  rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "log_audit_event could not find" } }),
      from: (table: string) => {
        if (table === "audit_logs") {
          auditLogsCall++;
          if (auditLogsCall === 1) return makeChain({ data: null, error: null });
          return makeInsertChain({ data: null, error: { message: "audit_logs not found" } });
        }
        if (table === "app_logs")   return makeInsertChain({ data: { id: "applog-1" }, error: null });
        return makeChain({ data: null, error: null });
      },
    });
    const id = await logAuditEvent({ userId: "u1", action: "create", resourceType: "trade" });
    expect(id).toBe("applog-1");
  });

  it("Si TODOS los fallbacks fallan → null", async () => {
    let auditLogsCall = 0;
    createServerClientMock.mockReturnValue({
      rpc:  rpcMock.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "log_audit_event could not find" } }),
      from: (table: string) => {
        if (table === "audit_logs") {
          auditLogsCall++;
          if (auditLogsCall === 1) return makeChain({ data: null, error: null });
          return makeInsertChain({ data: null, error: { message: "x" } });
        }
        if (table === "app_logs")   return makeInsertChain({ data: null, error: { message: "y" } });
        return makeChain({ data: null, error: null });
      },
    });
    const id = await logAuditEvent({ userId: "u1", action: "create", resourceType: "trade" });
    expect(id).toBeNull();
  });
});

describe("logAuditFromRequest", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    rpcMock.mockReset();
  });

  it("extrae ipHint y userAgentHash de headers del Request", async () => {
    let receivedArgs: Record<string, unknown> | null = null;
    createServerClientMock.mockReturnValue({
      rpc: (fn: string, args: Record<string, unknown>) => {
        receivedArgs = args;
        return Promise.resolve({ data: "audit-row", error: null });
      },
      from: () => makeChain({ data: null, error: null }),
    });

    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.42, 198.51.100.1",
        "user-agent":      "TestAgent/1.0",
      },
    });
    await logAuditFromRequest(
      { userId: "u1", action: "create", resourceType: "trade" },
      req,
    );

    expect((receivedArgs as unknown as { p_ip_hint: string })?.p_ip_hint).toBe("203.0.113.42");
    // user-agent hashed (SHA-256 hex)
    expect((receivedArgs as unknown as { p_user_agent_hash: string })?.p_user_agent_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ipHint='unknown' cuando x-forwarded-for está vacío", async () => {
    let receivedArgs: Record<string, unknown> | null = null;
    createServerClientMock.mockReturnValue({
      rpc: (fn: string, args: Record<string, unknown>) => {
        receivedArgs = args;
        return Promise.resolve({ data: "audit-row", error: null });
      },
      from: () => makeChain({ data: null, error: null }),
    });

    const req = new Request("http://localhost/api/x", { method: "POST" });
    await logAuditFromRequest(
      { userId: "u1", action: "create", resourceType: "trade" },
      req,
    );

    expect((receivedArgs as unknown as { p_ip_hint: string })?.p_ip_hint).toBe("unknown");
  });

  it("Sin request argument → no extrae ipHint ni userAgentHash", async () => {
    let receivedArgs: Record<string, unknown> | null = null;
    createServerClientMock.mockReturnValue({
      rpc: (fn: string, args: Record<string, unknown>) => {
        receivedArgs = args;
        return Promise.resolve({ data: "audit-row", error: null });
      },
      from: () => makeChain({ data: null, error: null }),
    });

    await logAuditFromRequest({ userId: "u1", action: "create", resourceType: "trade" });
    expect((receivedArgs as unknown as { p_ip_hint: string | null })?.p_ip_hint).toBeNull();
    expect((receivedArgs as unknown as { p_user_agent_hash: string | null })?.p_user_agent_hash).toBeNull();
  });
});
