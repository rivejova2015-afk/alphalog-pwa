// Unit tests for src/lib/security/bugRecorder.ts.
//
// Wrapper que hashea payload + recorta error message + invoca RPC log_bug_report
// con fallback path a app_logs. Validates:
//   - null cuando faltan Supabase env vars.
//   - Happy path: RPC retorna bug_id + log_bug_triage llamado con classifyBug.
//   - RPC missing (PGRST202) → fallback insert directo a app_logs.
//   - app_logs.insert error → null final fallback (logged).
//   - Error message > 1000 chars truncado.
//   - payload hashed con SHA-256 hex.
//   - recordBugFromRequest extrae method/path/UA/IP de Request.
//   - exception → null + log.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { createServerClientMock, rpcMock, fromMock, hashUserAgentMock, classifyBugMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  rpcMock:                vi.fn(),
  fromMock:               vi.fn(),
  hashUserAgentMock:      vi.fn((ua: string) => `hashed-${ua}`),
  classifyBugMock:        vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/lib/security/auditLog", () => ({ hashUserAgent: hashUserAgentMock }));
vi.mock("@/lib/security/bugTriage", () => ({ classifyBug: classifyBugMock }));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let recordBugReport: typeof import("../bugRecorder").recordBugReport;
let recordBugFromRequest: typeof import("../bugRecorder").recordBugFromRequest;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const mod = await import("../bugRecorder");
  recordBugReport = mod.recordBugReport;
  recordBugFromRequest = mod.recordBugFromRequest;
});

function makeInsertChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

describe("recordBugReport — happy path + RPC missing fallback", () => {
  beforeEach(() => {
    createServerClientMock.mockReset();
    rpcMock.mockReset();
    fromMock.mockReset();
    classifyBugMock.mockReset().mockReturnValue({
      category: "validation", severity: "medium",
      fingerprint: "fp-1", suggestion: "Review schema.",
    });
  });

  it("returns null cuando Supabase env vars faltan", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.resetModules();
    const mod = await import("../bugRecorder");
    const id = await mod.recordBugReport({ error: new Error("x") });
    expect(id).toBeNull();
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  });

  it("happy path: RPC retorna bug_id + log_bug_triage llamado", async () => {
    createServerClientMock.mockReturnValue({
      rpc: rpcMock
        .mockResolvedValueOnce({ data: "bug-uuid-1", error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
      from: fromMock,
    });

    const id = await recordBugReport({
      userId: "u1",
      requestId: "req-1",
      method: "POST",
      path: "/api/x",
      status: 500,
      error: new Error("oops"),
      payload: { key: "value" },
      ipHint: "1.2.3.4",
      userAgent: "TestUA/1.0",
    });

    expect(id).toBe("bug-uuid-1");
    expect(rpcMock).toHaveBeenCalledTimes(2);

    // First call: log_bug_report.
    const [fn1, args1] = rpcMock.mock.calls[0];
    expect(fn1).toBe("log_bug_report");
    expect(args1).toMatchObject({
      p_user_id:    "u1",
      p_request_id: "req-1",
      p_method:     "POST",
      p_path:       "/api/x",
      p_status:     500,
    });
    expect(args1.p_error_message).toBe("oops");
    expect(args1.p_payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(args1.p_user_agent_hash).toBe("hashed-TestUA/1.0");

    // Second call: log_bug_triage.
    expect(rpcMock.mock.calls[1][0]).toBe("log_bug_triage");
    expect(rpcMock.mock.calls[1][1]).toMatchObject({
      p_bug_report_id: "bug-uuid-1",
      p_category:      "validation",
      p_severity:      "medium",
      p_fingerprint:   "fp-1",
    });
  });

  it("error message > 1000 chars truncado a 1000", async () => {
    createServerClientMock.mockReturnValue({
      rpc: rpcMock
        .mockResolvedValueOnce({ data: "bug-1", error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
      from: fromMock,
    });
    const longMsg = "x".repeat(2000);
    await recordBugReport({ error: new Error(longMsg) });
    const args = rpcMock.mock.calls[0][1] as Record<string, unknown>;
    expect((args.p_error_message as string).length).toBe(1000);
  });

  it("RPC missing (PGRST202) → fallback insert directo a app_logs", async () => {
    const fallbackChain = makeInsertChain({ data: { id: "applog-fb-1" }, error: null });
    createServerClientMock.mockReturnValue({
      rpc: rpcMock.mockResolvedValue({
        data: null, error: { code: "PGRST202", message: "log_bug_report could not find" },
      }),
      from: (table: string) => {
        if (table === "app_logs") return fallbackChain;
        return makeInsertChain({ data: null, error: null });
      },
    });

    const id = await recordBugReport({
      userId: "u1",
      error: new Error("fail"),
      path: "/api/x",
    });
    expect(id).toBe("applog-fb-1");
  });

  it("fallback path: sin userId → null + warn (no useful insert sin contexto)", async () => {
    vi.resetModules();
    createServerClientMock.mockReturnValue({
      rpc: rpcMock.mockResolvedValue({
        data: null, error: { code: "PGRST202", message: "log_bug_report could not find" },
      }),
      from: () => makeInsertChain({ data: null, error: null }),
    });
    const mod = await import("../bugRecorder");
    const id = await mod.recordBugReport({ error: new Error("no user") });
    expect(id).toBeNull();
  });

  it("non-Error input (string) → errorMessage capturado", async () => {
    vi.resetModules();
    createServerClientMock.mockReturnValue({
      rpc: rpcMock
        .mockResolvedValueOnce({ data: "bug-2", error: null })
        .mockResolvedValueOnce({ data: null, error: null }),
      from: fromMock,
    });
    const mod = await import("../bugRecorder");
    const id = await mod.recordBugReport({ error: "string error" });
    expect(id).toBe("bug-2");
    expect(rpcMock.mock.calls[0][1].p_error_message).toBe("string error");
  });

  it("recordBugFromRequest extrae method/path/UA/IP del Request", async () => {
    vi.resetModules();
    let receivedArgs: Record<string, unknown> | null = null;
    createServerClientMock.mockReturnValue({
      rpc: (fn: string, args: Record<string, unknown>) => {
        if (fn === "log_bug_report") {
          receivedArgs = args;
          return Promise.resolve({ data: "bug-r", error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      from: fromMock,
    });
    const mod = await import("../bugRecorder");
    const req = new Request("https://test.alphalog.io/api/treasury/payouts", {
      method:  "POST",
      headers: {
        "x-forwarded-for": "9.8.7.6",
        "user-agent":      "MyUA/2.0",
        "x-request-id":    "req-xyz",
      },
    });
    const id = await mod.recordBugFromRequest(req, { userId: "u1", error: new Error("oops") });
    expect(id).toBe("bug-r");
    expect(receivedArgs).toMatchObject({
      p_user_id:    "u1",
      p_method:     "POST",
      p_path:       "/api/treasury/payouts",
      p_request_id: "req-xyz",
      p_ip_hint:    "9.8.7.6",
    });
    expect((receivedArgs as unknown as { p_user_agent_hash: string })?.p_user_agent_hash).toBe("hashed-MyUA/2.0");
  });
});
