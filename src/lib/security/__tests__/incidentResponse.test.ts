// Unit tests for src/lib/security/incidentResponse.ts.
//
// triggerIncidentResponse es un wrapper fire-and-forget para amenazas
// críticas. Validates:
//   - Sin Supabase env vars: NO toca DB pero SÍ envía push si tiene secrets.
//   - app_logs.insert llamado con level=error + threat en meta + fingerprint.
//   - credential_compromise → admin.auth.admin.signOut('global').
//   - db_tampering / data_breach → upsert lockdown flag a api_rate_limits.
//   - Push notification con title='[CRITICAL]...', body incluye steps.
//   - Catch silencioso si throw inesperado (no-throw guarantee).
//   - Sin INTERNAL_API_SECRET / SECURITY_ALERT_USER_ID → no se envía push.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { createClientMock, fromMock, signOutMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fromMock:         vi.fn(),
  signOutMock:      vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let triggerIncidentResponse: typeof import("../incidentResponse").triggerIncidentResponse;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.INTERNAL_API_SECRET = "internal-secret";
  process.env.SECURITY_ALERT_USER_ID = "owner-uuid";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
  const mod = await import("../incidentResponse");
  triggerIncidentResponse = mod.triggerIncidentResponse;
});

interface FromCalls {
  appLogsInsert?: Record<string, unknown>;
  rateLimitUpsert?: Record<string, unknown>;
}

function setupSupabase(opts: { insertError?: { message: string } } = {}) {
  const calls: FromCalls = {};
  fromMock.mockImplementation((table: string) => {
    if (table === "app_logs") {
      return {
        insert: (row: Record<string, unknown>) => {
          calls.appLogsInsert = row;
          return Promise.resolve({ error: opts.insertError ?? null });
        },
      };
    }
    if (table === "api_rate_limits") {
      return {
        upsert: (row: Record<string, unknown>) => {
          calls.rateLimitUpsert = row;
          return Promise.resolve({ error: null });
        },
      };
    }
    return {};
  });
  createClientMock.mockReturnValue({
    from: fromMock,
    auth: { admin: { signOut: signOutMock } },
  });
  return calls;
}

describe("triggerIncidentResponse", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    fromMock.mockReset();
    signOutMock.mockReset().mockResolvedValue({ data: {}, error: null });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  });

  it("inserta a app_logs con level=error + threat en meta + fingerprint", async () => {
    const calls = setupSupabase();
    await triggerIncidentResponse("db_tampering");

    expect(calls.appLogsInsert).toMatchObject({
      level:   "error",
      area:    "incident_response",
      user_id: "owner-uuid",
    });
    expect((calls.appLogsInsert!.meta as { threat: string }).threat).toBe("db_tampering");
    expect(calls.appLogsInsert!.message).toMatch(/\[INCIDENT\] db_tampering/);
    expect((calls.appLogsInsert!.fingerprint as string)).toMatch(/^incident:db_tampering:/);
  });

  it("credential_compromise → signOut('global')", async () => {
    setupSupabase();
    await triggerIncidentResponse("credential_compromise");
    expect(signOutMock).toHaveBeenCalledWith("owner-uuid", "global");
  });

  it("data_breach → ALSO signOut + lockdown upsert", async () => {
    const calls = setupSupabase();
    await triggerIncidentResponse("data_breach");
    expect(signOutMock).toHaveBeenCalledWith("owner-uuid", "global");
    expect(calls.rateLimitUpsert).toMatchObject({ key: "incident:lockdown", hits: 1 });
  });

  it("db_tampering → lockdown upsert pero NO signOut", async () => {
    const calls = setupSupabase();
    await triggerIncidentResponse("db_tampering");
    expect(signOutMock).not.toHaveBeenCalled();
    expect(calls.rateLimitUpsert).toMatchObject({ key: "incident:lockdown" });
  });

  it("envía push notification con title=[CRITICAL]... y body con steps", async () => {
    setupSupabase();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await triggerIncidentResponse("data_breach");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.alphalog.io/api/push/notify-user");
    const body = JSON.parse(init.body as string);
    expect(body.title).toMatch(/\[CRITICAL\] Security Incident: DATA BREACH/);
    expect(body.body).toMatch(/logged.*sessions_revoked.*lockdown_flag_set/);
    expect(body.tag).toBe("incident-data_breach");
    expect(body.data.threat).toBe("data_breach");
    expect(body.data.steps).toContain("logged");
  });

  it("Sin Supabase env vars → no DB calls pero SÍ push", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Re-import a fresh copy so the module re-reads the env vars.
    vi.resetModules();
    const mod = await import("../incidentResponse");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await mod.triggerIncidentResponse("data_breach");

    expect(createClientMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
  });

  it("Sin INTERNAL_API_SECRET → no push (pero sí DB)", async () => {
    const calls = setupSupabase();
    const savedSecret = process.env.INTERNAL_API_SECRET;
    delete process.env.INTERNAL_API_SECRET;

    vi.resetModules();
    const mod = await import("../incidentResponse");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await mod.triggerIncidentResponse("db_tampering");

    expect(calls.appLogsInsert).toBeDefined();  // DB still happens
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.INTERNAL_API_SECRET = savedSecret;
  });

  it("no-throw guarantee: catch silencioso cuando supabase throws inesperado", async () => {
    createClientMock.mockImplementation(() => { throw new Error("supabase init crashed"); });
    await expect(triggerIncidentResponse("db_tampering")).resolves.toBeUndefined();
  });
});
