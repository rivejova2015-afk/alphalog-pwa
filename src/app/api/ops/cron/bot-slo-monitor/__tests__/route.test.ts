// Integration test for /api/ops/cron/bot-slo-monitor POST handler.
//
// Cron que monitorea heartbeat + command-ack SLOs y dispara alertas. Covers:
//   1. 401 cuando auth Bearer token falla.
//   2. 500 cuando Supabase env vars faltan.
//   3. Status=PASS cuando todo está sano (heartbeats frescos, no pending cmds).
//   4. NO_HEARTBEAT check para instances con last_heartbeat_at=null.
//   5. STALE_HEARTBEAT S1 cuando heartbeat > 300s (severo).
//   6. STALE_HEARTBEAT S2 cuando heartbeat entre 120-300s (degraded).
//   7. COMMAND_UNACKED check para pending commands > 60s.
//   8. Severity rollup: max severity gana (S1 > S2 > S3 > NONE).
//   9. Alert dispatch a /api/ops/bot-slo-alert cuando severity ∈ {S1,S2}.
//  10. NO alert cuando severity=NONE.
//  11. Profile breakdown por nombre de bot (forex/futuros).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  pgFromMock,
  validateBearerMock,
} = vi.hoisted(() => ({
  createClientMock:    vi.fn(),
  pgFromMock:          vi.fn(),
  validateBearerMock:  vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
// `bot_instances` + `bot_command_status` are in-scope (own Postgres) — the
// route now reads them via getPgClient() instead of the Supabase service
// client. `bots` is NOT one of the 16 migrated tables and stays on the
// Supabase mock above.
vi.mock("@/lib/pg/client", () => ({ getPgClient: () => ({ from: pgFromMock }) }));
vi.mock("@/lib/security/timing", () => ({ validateBearerToken: validateBearerMock }));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.CRON_SECRET = "test-secret";
  process.env.ALPHALOG_WEB_URL = "http://localhost:3000";
  process.env.OPS_ALERT_TOKEN = "ops-token";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ops/cron/bot-slo-monitor", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

interface BotRow { id: string; name: string }
interface InstanceRow { id: string; bot_account_id: string; status: string; last_heartbeat_at: string | null }
interface CmdStatusRow { id: string; bot_account_id: string; status: string; created_at: string; acked_at: string | null }

function setupSupabase({
  bots = [],
  instances = [],
  cmdStatus = [],
}: {
  bots?:      BotRow[];
  instances?: InstanceRow[];
  cmdStatus?: CmdStatusRow[];
}) {
  createClientMock.mockReturnValue({
    from: (table: string) => {
      const proxy: Record<string, unknown> = {};
      const chainable = ["select", "eq", "is", "in", "order", "limit"];
      for (const m of chainable) proxy[m] = () => proxy;
      const result: { data: unknown; error: unknown } =
        table === "bots" ? { data: bots, error: null } : { data: [], error: null };
      proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
      return proxy;
    },
  });

  pgFromMock.mockImplementation((table: string) => {
    const proxy: Record<string, unknown> = {};
    const chainable = ["select", "eq", "is", "in", "order", "limit"];
    for (const m of chainable) proxy[m] = () => proxy;
    let result: { data: unknown; error: unknown };
    if (table === "bot_instances") result = { data: instances, error: null };
    else if (table === "bot_command_status") result = { data: cmdStatus, error: null };
    else result = { data: [], error: null };
    proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    return proxy;
  });
}

describe("/api/ops/cron/bot-slo-monitor — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    pgFromMock.mockReset();
    validateBearerMock.mockReset();
    validateBearerMock.mockReturnValue({ ok: true });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
  });

  it("returns 401 when validateBearerToken rejects", async () => {
    validateBearerMock.mockReturnValue({ ok: false, error: "Unauthorized", status: 401 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns status=PASS when all instances are healthy and no pending commands", async () => {
    setupSupabase({
      bots: [],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: new Date().toISOString() }],
      cmdStatus: [],
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.report.status).toBe("PASS");
    expect(body.report.severity).toBe("NONE");
    expect(body.report.checks).toEqual([]);
  });

  it("adds NO_HEARTBEAT check for instances with null last_heartbeat_at", async () => {
    setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: null }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "NO_HEARTBEAT", severity: "S2" }),
    ]));
    expect(body.report.severity).toBe("S2");
    expect(body.report.status).toBe("DEGRADED");
  });

  it("STALE_HEARTBEAT S1 when heartbeat > 300s ago (severo)", async () => {
    const oldIso = new Date(Date.now() - 400 * 1000).toISOString();
    setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: oldIso }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "STALE_HEARTBEAT", severity: "S1" }),
    ]));
    expect(body.report.severity).toBe("S1");
    expect(body.report.status).toBe("FAIL");
  });

  it("STALE_HEARTBEAT S2 when heartbeat between 120-300s ago", async () => {
    const oldIso = new Date(Date.now() - 200 * 1000).toISOString();
    setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: oldIso }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "STALE_HEARTBEAT", severity: "S2" }),
    ]));
    expect(body.report.severity).toBe("S2");
  });

  it("COMMAND_UNACKED check for pending commands > 60s", async () => {
    setupSupabase({
      instances: [],
      cmdStatus: [{
        id: "c1", bot_account_id: "ba1", status: "PENDING",
        created_at: new Date(Date.now() - 90 * 1000).toISOString(),
        acked_at: null,
      }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "COMMAND_UNACKED" }),
    ]));
  });

  it("dispatches alert to /api/ops/bot-slo-alert when severity >= S2", async () => {
    setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: null }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await POST(makeRequest());

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/ops/bot-slo-alert"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does NOT dispatch alert when severity=NONE (healthy)", async () => {
    setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: new Date().toISOString() }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await POST(makeRequest());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves byProfile bots by name pattern (forex/futuros)", async () => {
    setupSupabase({
      bots: [
        { id: "b1", name: "Forex bot" },
        { id: "b2", name: "Futuros 50x" },
        { id: "b3", name: "Other random" },
      ],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.byProfile.forex).toMatchObject({ botId: "b1" });
    expect(body.report.byProfile.futuros).toMatchObject({ botId: "b2" });
  });
});
