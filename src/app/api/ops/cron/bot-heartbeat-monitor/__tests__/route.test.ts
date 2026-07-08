// Integration test for /api/ops/cron/bot-heartbeat-monitor POST handler.
//
// Cron que detecta stale heartbeats en bot_instances con state machine
// UP/DOWN + re-alert cada 10 min + auto-recovery RESTART_LOGIC. Covers:
//   1. 401 cuando validateBearerToken rechaza.
//   2. checked=0 cuando no hay instances.
//   3. Healthy instance → 'healthy', no action.
//   4. UP→DOWN transition → 'alerted_down' + sendPush + sendRecoveryCommand
//      + bot_monitor_state upsert con is_down=true.
//   5. DOWN→UP transition (recovered) → 'alerted_recovered' + upsert is_down=false.
//   6. Still DOWN dentro de 10min → 'still_down', no push.
//   7. Still DOWN > 10min desde last_alerted_at → 're_alerted_still_down' +
//      update last_alerted_at.
//   8. Instance sin user_id (account orphan) → skipped silently.
//   9. Instance sin last_heartbeat_at → tratada como Infinity stale → DOWN.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock, pgFromMock, validateBearerMock } = vi.hoisted(() => ({
  createClientMock:   vi.fn(),
  pgFromMock:         vi.fn(),
  validateBearerMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
// `bot_instances`, `bot_accounts` and `bot_commands` are in-scope (own
// Postgres) — the route now reads/writes them via getPgClient() instead of
// the Supabase service client. `bot_monitor_state` is NOT one of the 16
// migrated tables and stays on the Supabase mock above.
vi.mock("@/lib/pg/client", () => ({ getPgClient: () => ({ from: pgFromMock }) }));
vi.mock("@/lib/security/timing", () => ({ validateBearerToken: validateBearerMock }));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.CRON_SECRET = "cron-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
  process.env.INTERNAL_API_SECRET = "internal-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ops/cron/bot-heartbeat-monitor", {
    method: "POST",
    headers: { authorization: "Bearer cron-secret" },
  });
}

interface InstanceRow { id: string; bot_account_id: string; last_heartbeat_at: string | null; status: string }
interface StateRow {
  bot_instance_id: string;
  is_down: boolean;
  down_since: string | null;
  last_alerted_at: string | null;
  recovery_cmd_id: string | null;
}
interface AccountRow { id: string; bot_id: string; user_id: string }

function setupSupabase({
  instances = [],
  states = [],
  accounts = [],
}: {
  instances?: InstanceRow[];
  states?:    StateRow[];
  accounts?:  AccountRow[];
}) {
  const upserts: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const updates: Array<{ patch: Record<string, unknown>; instanceId: string | null }> = [];

  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "bot_monitor_state") {
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: states, error: null }).then(resolve);
        proxy.upsert = (row: Record<string, unknown>) => {
          upserts.push(row);
          return Promise.resolve({ error: null });
        };
        // update().eq()
        proxy.update = (patch: Record<string, unknown>) => {
          let capturedId: string | null = null;
          const u: Record<string, unknown> = {};
          u.eq = (col: string, val: string) => {
            if (col === "bot_instance_id") capturedId = val;
            updates.push({ patch, instanceId: capturedId });
            return Promise.resolve({ error: null });
          };
          return u;
        };
        return proxy;
      }
      const fallback: Record<string, unknown> = {};
      fallback.select = () => fallback;
      fallback.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return fallback;
    },
  });

  pgFromMock.mockImplementation((table: string) => {
    if (table === "bot_instances") {
      const proxy: Record<string, unknown> = {};
      proxy.select = () => proxy;
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: instances, error: null }).then(resolve);
      return proxy;
    }
    if (table === "bot_accounts") {
      const proxy: Record<string, unknown> = {};
      proxy.select = () => proxy;
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: accounts, error: null }).then(resolve);
      return proxy;
    }
    if (table === "bot_commands") {
      const proxy: Record<string, unknown> = {};
      proxy.insert = (row: Record<string, unknown>) => {
        inserts.push(row);
        const ret: Record<string, unknown> = {};
        ret.select = () => ret;
        ret.single = () => Promise.resolve({ data: { id: "cmd-new-1" }, error: null });
        return ret;
      };
      return proxy;
    }
    const fallback: Record<string, unknown> = {};
    fallback.select = () => fallback;
    fallback.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return fallback;
  });

  return { upserts, inserts, updates };
}

describe("/api/ops/cron/bot-heartbeat-monitor — handler", () => {
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

  it("returns checked=0 when there are no instances", async () => {
    setupSupabase({ instances: [], accounts: [] });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.checked).toBe(0);
    expect(body.results).toEqual([]);
  });

  it("healthy instance (heartbeat < 120s) → action='healthy', no push, no upsert", async () => {
    const { upserts, inserts } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: new Date().toISOString(), status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ instanceId: "i1", action: "healthy" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("UP→DOWN: stale instance + no state → recovery command + upsert + push", async () => {
    const staleIso = new Date(Date.now() - 200 * 1000).toISOString();
    const { upserts, inserts } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: staleIso, status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
      states:    [],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ instanceId: "i1", action: "alerted_down" });

    // Recovery command inserted into bot_commands.
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      bot_id:       "b1",
      command_type: "RESTART_LOGIC",
      target_scope: "all",
      status:       "PENDING",
    });

    // bot_monitor_state upsert con is_down=true + recovery_cmd_id.
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      bot_instance_id: "i1",
      is_down:         true,
      recovery_cmd_id: "cmd-new-1",
    });

    // Push notification sent.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/push/notify-user"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("DOWN→UP: healthy instance + state.is_down=true → upsert is_down=false + push 'recuperado'", async () => {
    const freshIso = new Date(Date.now() - 30 * 1000).toISOString();
    const { upserts, inserts } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: freshIso, status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
      states:    [{ bot_instance_id: "i1", is_down: true, down_since: "2026-06-14T00:00:00Z", last_alerted_at: "2026-06-14T01:00:00Z", recovery_cmd_id: "cmd-prev" }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ action: "alerted_recovered" });
    expect(upserts[0]).toMatchObject({
      bot_instance_id: "i1",
      is_down:         false,
      down_since:      null,
      recovery_cmd_id: null,
    });
    expect(inserts).toHaveLength(0);  // NO recovery command on recovery transition.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still down within 10min window → 'still_down', no re-alert", async () => {
    const staleIso = new Date(Date.now() - 200 * 1000).toISOString();
    const recentlyAlertedIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();  // 5min ago
    const { upserts, inserts, updates } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: staleIso, status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
      states:    [{ bot_instance_id: "i1", is_down: true, down_since: staleIso, last_alerted_at: recentlyAlertedIso, recovery_cmd_id: "cmd-prev" }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ action: "still_down" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("still down > 10min → 're_alerted_still_down' + last_alerted_at update + push", async () => {
    const staleIso = new Date(Date.now() - 1200 * 1000).toISOString();  // 20min stale
    const oldAlertIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();  // 15min ago
    const { updates } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: staleIso, status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
      states:    [{ bot_instance_id: "i1", is_down: true, down_since: staleIso, last_alerted_at: oldAlertIso, recovery_cmd_id: "cmd-prev" }],
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ action: "re_alerted_still_down" });
    expect(updates).toHaveLength(1);
    expect(updates[0].instanceId).toBe("i1");
    expect((updates[0].patch as { last_alerted_at: string }).last_alerted_at).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("instance with no matching account (orphan) is silently skipped", async () => {
    const staleIso = new Date(Date.now() - 200 * 1000).toISOString();
    const { upserts, inserts } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba_orphan", last_heartbeat_at: staleIso, status: "running" }],
      accounts:  [],  // ← no matching account
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(upserts).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  it("instance with null last_heartbeat_at → ageSec=Infinity → DOWN transition", async () => {
    const { inserts, upserts } = setupSupabase({
      instances: [{ id: "i1", bot_account_id: "ba1", last_heartbeat_at: null, status: "running" }],
      accounts:  [{ id: "ba1", bot_id: "b1", user_id: "u1" }],
      states:    [],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ action: "alerted_down" });
    expect(inserts).toHaveLength(1);  // RESTART_LOGIC dispatched
    expect(upserts).toHaveLength(1);  // state.is_down=true
  });
});
