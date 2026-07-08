// Integration test for /api/ops/cron/bot-auto-recovery POST handler.
//
// Cron que re-inicia bots stale con cooldown 30min. Covers:
//   1. 401 cuando auth Bearer falla.
//   2. Bot sin bot_accounts → skipped 'no_bot_accounts'.
//   3. Bot con instances frescos → skipped 'healthy'.
//   4. Bot con stale instance pero RESTART_LOGIC reciente → skipped
//      'cooldown_active'.
//   5. Bot stale sin cooldown → inserta bot_commands RESTART_LOGIC +
//      bot_command_status rows + bot_events.
//   6. report.actions tracks bot_id + profile + command_id.
//   7. command insert error → report.errors[] capturado, loop continúa.
//   8. Bot.name sin "forex"/"futuros" → skipped (no profile).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock, pgFromMock, validateBearerMock } = vi.hoisted(() => ({
  createClientMock:   vi.fn(),
  pgFromMock:         vi.fn(),
  validateBearerMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
// `bot_accounts`, `bot_instances`, `bot_commands`, `bot_command_status` and
// `bot_events` are in-scope (own Postgres) — the route now reads/writes them
// via getPgClient() instead of the Supabase service client. `bots` is NOT one
// of the 16 migrated tables and stays on the Supabase mock above.
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
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ops/cron/bot-auto-recovery", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

interface BotRow      { id: string; name: string }
interface BotAccRow   { id: string; bot_id: string }
interface InstanceRow { id: string; bot_account_id: string; status: string; last_heartbeat_at: string | null }

function setupSupabase({
  bots = [], botAccounts = [], instances = [],
  recentRestartCmds = {},
  insertCmdResult = { data: { id: "cmd-new-1" }, error: null },
}: {
  bots?:        BotRow[];
  botAccounts?: BotAccRow[];
  instances?:   InstanceRow[];
  recentRestartCmds?: Record<string, Array<{ id: string; created_at: string }>>;
  insertCmdResult?: { data: { id: string } | null; error: unknown };
}) {
  createClientMock.mockReturnValue({
    from: (table: string) => {
      const proxy: Record<string, unknown> = {};
      const chainable = ["eq", "is", "in", "gte", "order", "limit"];
      for (const m of chainable) proxy[m] = () => proxy;

      if (table === "bots") {
        proxy.select = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: bots, error: null }).then(resolve);
        return proxy;
      }
      proxy.select = () => proxy;
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return proxy;
    },
  });

  pgFromMock.mockImplementation((table: string) => {
    const proxy: Record<string, unknown> = {};
    const chainable = ["eq", "is", "in", "gte", "order", "limit"];
    for (const m of chainable) proxy[m] = () => proxy;

    if (table === "bot_accounts") {
      proxy.select = () => proxy;
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: botAccounts, error: null }).then(resolve);
      return proxy;
    }
    if (table === "bot_instances") {
      proxy.select = () => proxy;
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: instances, error: null }).then(resolve);
      return proxy;
    }
    if (table === "bot_commands") {
      let currentBotId: string | null = null;
      const cmdProxy: Record<string, unknown> = {};
      cmdProxy.select = () => cmdProxy;
      cmdProxy.eq = (col: string, val: string) => {
        if (col === "bot_id") currentBotId = val;
        return cmdProxy;
      };
      cmdProxy.gte = () => cmdProxy;
      cmdProxy.limit = () => cmdProxy;
      cmdProxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: recentRestartCmds[currentBotId ?? ""] ?? [], error: null }).then(resolve);
      cmdProxy.insert = () => {
        const ins: Record<string, unknown> = {};
        ins.select = () => ins;
        ins.single = () => Promise.resolve(insertCmdResult);
        return ins;
      };
      return cmdProxy;
    }
    if (table === "bot_command_status" || table === "bot_events") {
      const ins: Record<string, unknown> = {};
      ins.insert = () => Promise.resolve({ error: null });
      ins.select = () => ins;
      ins.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ error: null }).then(resolve);
      return ins;
    }
    proxy.select = () => proxy;
    proxy.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve);
    return proxy;
  });
}

const STALE_HEARTBEAT_ISO = new Date(Date.now() - 600 * 1000).toISOString(); // > 120 * 2.5 = 300s

describe("/api/ops/cron/bot-auto-recovery — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    pgFromMock.mockReset();
    validateBearerMock.mockReset();
    validateBearerMock.mockReturnValue({ ok: true });
  });

  it("returns 401 when auth fails", async () => {
    validateBearerMock.mockReturnValue({ ok: false, error: "x", status: 401 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("SKIPS bot with no bot_accounts (reason='no_bot_accounts')", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      botAccounts: [],
      instances: [],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.skipped).toContainEqual({ bot_id: "b1", reason: "no_bot_accounts" });
  });

  it("SKIPS bot with healthy instances (reason='healthy')", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: new Date().toISOString() }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.skipped).toContainEqual({ bot_id: "b1", reason: "healthy" });
    expect(body.report.actions).toEqual([]);
  });

  it("SKIPS bot when a RESTART_LOGIC was issued within the cooldown window", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: STALE_HEARTBEAT_ISO }],
      recentRestartCmds: { b1: [{ id: "cmd-old", created_at: new Date().toISOString() }] },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.skipped).toContainEqual({ bot_id: "b1", reason: "cooldown_active", profile: "forex" });
    expect(body.report.actions).toEqual([]);
  });

  it("issues RESTART_LOGIC command when stale bot has no recent restart", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: STALE_HEARTBEAT_ISO }],
      recentRestartCmds: {},
      insertCmdResult: { data: { id: "cmd-new" }, error: null },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.actions).toContainEqual(
      expect.objectContaining({
        bot_id:       "b1",
        profile:      "forex",
        command_id:   "cmd-new",
        command_type: "RESTART_LOGIC",
      }),
    );
  });

  it("captures cmd insert error into report.errors and skips action", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: STALE_HEARTBEAT_ISO }],
      recentRestartCmds: {},
      insertCmdResult: { data: null, error: { message: "constraint violation" } },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.report.errors[0]).toMatch(/constraint violation/);
    expect(body.report.actions).toEqual([]);
  });

  it("bots without 'forex' or 'futuros' in name are silently skipped (no profile)", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Random bot xyz" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "running", last_heartbeat_at: STALE_HEARTBEAT_ISO }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    // Not added to skipped[] nor actions[] — the inner continue happens before either.
    expect(body.report.actions).toEqual([]);
    expect(body.report.skipped).toEqual([]);
    expect(body.report.errors).toEqual([]);
  });
});
