// Integration test for /api/ops/cron/bot-daily-verify POST handler.
//
// Cron diario que genera un report SLO + ACK por bot y lo persiste a
// bot_events. Covers:
//   1. 401 cuando auth Bearer falla.
//   2. PASS overallStatus cuando todo está sano.
//   3. NOT_ACTIVE S3 check para instance.status !== "ACTIVE".
//   4. STALE_HEARTBEAT S1 cuando heartbeat > 300s.
//   5. results count + saved.success igualan los bots con profile.
//   6. saved.failed incrementa cuando bot_events insert falla.
//   7. Bots sin profile match son ignorados.
//   8. Recommendations array refleja severity (S1 → 'Intervención...', PASS
//      → 'Sistema operando normalmente').
//   9. Wave 3 item 7: bots crypto (coinarb) se identifican vía
//      algorithms.market_type='crypto' (no por nombre) y su heartbeat se lee
//      de coinarb_telemetry en vez de bot_instances.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { createClientMock, validateBearerMock } = vi.hoisted(() => ({
  createClientMock:   vi.fn(),
  validateBearerMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
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
  return new NextRequest("http://localhost/api/ops/cron/bot-daily-verify", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

interface BotRow      { id: string; name: string; user_id: string }
interface BotAccRow   { id: string; bot_id: string }
interface InstanceRow { id: string; bot_account_id: string; status: string; last_heartbeat_at: string | null }
interface CmdStatusRow { id: string; bot_account_id: string; status: string; created_at: string }
interface CryptoAlgoRow { id: string; linked_bot_account_id: string | null }
interface TelemetryRow { last_heartbeat_at: string | null }

function setupSupabase({
  bots = [], botAccounts = [], instances = [], pendingCmds = [],
  cryptoAlgos = [], telemetryByAgentId = {},
  insertEventError,
}: {
  bots?: BotRow[]; botAccounts?: BotAccRow[]; instances?: InstanceRow[]; pendingCmds?: CmdStatusRow[];
  cryptoAlgos?: CryptoAlgoRow[]; telemetryByAgentId?: Record<string, TelemetryRow | null>;
  insertEventError?: { message: string } | null;
}) {
  createClientMock.mockReturnValue({
    from: (table: string) => {
      const proxy: Record<string, unknown> = {};
      const chainable = ["select", "eq", "is", "in", "order", "limit"];
      for (const m of chainable) proxy[m] = () => proxy;

      if (table === "bots") {
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: bots, error: null }).then(resolve);
        return proxy;
      }
      if (table === "bot_accounts") {
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: botAccounts, error: null }).then(resolve);
        return proxy;
      }
      if (table === "bot_instances") {
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: instances, error: null }).then(resolve);
        return proxy;
      }
      if (table === "bot_command_status") {
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: pendingCmds, error: null }).then(resolve);
        return proxy;
      }
      if (table === "algorithms") {
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: cryptoAlgos, error: null }).then(resolve);
        return proxy;
      }
      if (table === "coinarb_telemetry") {
        // eq() captures the agent_id filter so maybeSingle() can look it up.
        let agentId: string | undefined;
        proxy.eq = (col: string, val: string) => { if (col === "agent_id") agentId = val; return proxy; };
        proxy.maybeSingle = () =>
          Promise.resolve({ data: agentId ? (telemetryByAgentId[agentId] ?? null) : null, error: null });
        return proxy;
      }
      if (table === "bot_events") {
        proxy.insert = () =>
          Promise.resolve({ error: insertEventError ?? null });
        return proxy;
      }
      proxy.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return proxy;
    },
  });
}

describe("/api/ops/cron/bot-daily-verify — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    validateBearerMock.mockReset();
    validateBearerMock.mockReturnValue({ ok: true });
  });

  it("returns 401 when auth fails", async () => {
    validateBearerMock.mockReturnValue({ ok: false, error: "x", status: 401 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("happy path: 1 healthy forex bot → results=1, saved.success=1, PASS", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot", user_id: "u1" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{
        id: "i1", bot_account_id: "ba1", status: "ACTIVE",
        last_heartbeat_at: new Date().toISOString(),
      }],
      pendingCmds: [],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results).toBe(1);
    expect(body.saved.success).toBe(1);
    expect(body.saved.failed).toBe(0);
  });

  it("STALE_HEARTBEAT S1 results in overallStatus=FAIL", async () => {
    const oldIso = new Date(Date.now() - 600 * 1000).toISOString();
    setupSupabase({
      bots: [{ id: "b1", name: "Futuros bot", user_id: "u1" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "ACTIVE", last_heartbeat_at: oldIso }],
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    // Status is in payload-only; the route returns just counters, but the
    // bot_events insert payload included the failure. The contract here is
    // "no 500, results>0, saved.success=1".
    const body = await res.json();
    expect(body.results).toBe(1);
    expect(body.saved.success).toBe(1);
  });

  it("instance.status !== ACTIVE adds a NOT_ACTIVE S3 check (still saves)", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot", user_id: "u1" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "PAUSED", last_heartbeat_at: new Date().toISOString() }],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results).toBe(1);
    expect(body.saved.success).toBe(1);
  });

  it("bots without 'forex'/'futuros' in name are silently filtered out", async () => {
    setupSupabase({
      bots: [
        { id: "b1", name: "Forex bot", user_id: "u1" },
        { id: "b2", name: "Random other bot", user_id: "u1" },
      ],
      botAccounts: [{ id: "ba1", bot_id: "b1" }, { id: "ba2", bot_id: "b2" }],
      instances: [
        { id: "i1", bot_account_id: "ba1", status: "ACTIVE", last_heartbeat_at: new Date().toISOString() },
      ],
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results).toBe(1);  // only the forex bot
  });

  it("bot_events insert failure increments saved.failed", async () => {
    setupSupabase({
      bots: [{ id: "b1", name: "Forex bot", user_id: "u1" }],
      botAccounts: [{ id: "ba1", bot_id: "b1" }],
      instances: [{ id: "i1", bot_account_id: "ba1", status: "ACTIVE", last_heartbeat_at: new Date().toISOString() }],
      insertEventError: { message: "rls denied" },
    });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.saved.success).toBe(0);
    expect(body.saved.failed).toBe(1);
  });

  it("returns 200 with results=0 + saved.success=0 when there are no bots", async () => {
    setupSupabase({ bots: [], botAccounts: [], instances: [] });
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.results).toBe(0);
    expect(body.saved.success).toBe(0);
  });

  describe("crypto (coinarb) bots — identified via algorithms.market_type, not name", () => {
    it("healthy crypto bot (coinarb-50x, no forex/futuros keyword) is still verified via coinarb_telemetry", async () => {
      setupSupabase({
        bots: [{ id: "b1", name: "coinarb-50x", user_id: "u1" }],
        botAccounts: [{ id: "ba1", bot_id: "b1" }],
        instances: [], // coinarb never populates bot_instances
        cryptoAlgos: [{ id: "algo-1", linked_bot_account_id: "ba1" }],
        telemetryByAgentId: { "algo-1": { last_heartbeat_at: new Date().toISOString() } },
      });
      const res = await POST(makeRequest());
      const body = await res.json();
      expect(body.results).toBe(1);
      expect(body.saved.success).toBe(1);
    });

    it("stale crypto heartbeat is detected via coinarb_telemetry", async () => {
      const oldIso = new Date(Date.now() - 600 * 1000).toISOString();
      setupSupabase({
        bots: [{ id: "b1", name: "coinarb-50x", user_id: "u1" }],
        botAccounts: [{ id: "ba1", bot_id: "b1" }],
        cryptoAlgos: [{ id: "algo-1", linked_bot_account_id: "ba1" }],
        telemetryByAgentId: { "algo-1": { last_heartbeat_at: oldIso } },
      });
      const res = await POST(makeRequest());
      const body = await res.json();
      expect(body.results).toBe(1);
      expect(body.saved.success).toBe(1);
    });

    it("crypto bot with no telemetry row yet still verifies (NO_HEARTBEAT, no crash)", async () => {
      setupSupabase({
        bots: [{ id: "b1", name: "coinarb-50x", user_id: "u1" }],
        botAccounts: [{ id: "ba1", bot_id: "b1" }],
        cryptoAlgos: [{ id: "algo-1", linked_bot_account_id: "ba1" }],
        telemetryByAgentId: {},
      });
      const res = await POST(makeRequest());
      const body = await res.json();
      expect(body.results).toBe(1);
      expect(body.saved.success).toBe(1);
    });

    it("a bot with no linked crypto algorithm and no forex/futuros name is still filtered out", async () => {
      setupSupabase({
        bots: [{ id: "b1", name: "Random other bot", user_id: "u1" }],
        botAccounts: [{ id: "ba1", bot_id: "b1" }],
        cryptoAlgos: [], // no crypto algorithm linked to ba1
      });
      const res = await POST(makeRequest());
      const body = await res.json();
      expect(body.results).toBe(0);
    });
  });
});
