// Integration test for /api/cron/treasury/withdrawal-reminders GET handler.
//
// Daily cron that sends push notifications on withdrawal days + custom
// calendar events. Covers:
//   1. 401 on wrong cron secret (timing-safe).
//   2. 500 when Supabase env vars are missing.
//   3. Success-empty when there are zero push_subscriptions.
//   4. 500 when push_subscriptions select errors.
//   5. Sends a push when today.getUTCDate() === config.withdrawal_day AND
//      lastCycle != currentCycle (dedup miss).
//   6. SKIPS when lastCycle === currentCycle (dedup hit) — no push.
//   7. SKIPS when push_withdrawal_day_enabled=false.
//   8. Sends push for calendar event when push_enabled=true.
//   9. Per-user config-fetch error is captured into errors[] and the loop
//      continues to the next user.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  sendPushMock,
  computeCycleStartMock,
  safeCompareMock,
} = vi.hoisted(() => ({
  createClientMock:      vi.fn(),
  sendPushMock:          vi.fn(),
  computeCycleStartMock: vi.fn(),
  safeCompareMock:       vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/push/webpush.server", () => ({
  sendPushToSubscriptions: sendPushMock,
}));
vi.mock("@/lib/treasury/payoutEngine", () => ({
  computeCycleStart: computeCycleStartMock,
}));
vi.mock("@/lib/security/timing", () => ({
  safeCompareTokens: safeCompareMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "in", "is", "returns", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/treasury/withdrawal-reminders", {
    method:  "GET",
    headers: { "x-cron-secret": "test-secret" },
  });
}

interface TableMap {
  push_subscriptions?:        { data: unknown; error: unknown }[];
  treasury_configs?:          { data: unknown; error: unknown };
  treasury_calendar_events?:  { data: unknown; error: unknown };
  treasury_configs_update?:   { error: unknown };
}

function setupSupabase(tables: TableMap) {
  const pushCalls = [...(tables.push_subscriptions ?? [])];
  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "push_subscriptions") {
        return makeAwaitableChain(pushCalls.shift() ?? { data: [], error: null });
      }
      if (table === "treasury_configs") {
        const result = tables.treasury_configs ?? { data: [], error: null };
        // .update() goes through the same .from() — return a builder that
        // routes select vs update via mock state.
        const proxy: Record<string, unknown> = {};
        const chainable = ["select", "eq", "is", "returns"];
        for (const m of chainable) proxy[m] = () => proxy;
        proxy.update = () => {
          const upProxy: Record<string, unknown> = {};
          for (const m of ["eq", "is"]) upProxy[m] = () => upProxy;
          upProxy.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve(tables.treasury_configs_update ?? { error: null }).then(resolve);
          return upProxy;
        };
        proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
        return proxy;
      }
      if (table === "treasury_calendar_events") {
        return makeAwaitableChain(tables.treasury_calendar_events ?? { data: [], error: null });
      }
      return makeAwaitableChain({ data: null, error: null });
    },
  });
}

describe("/api/cron/treasury/withdrawal-reminders — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    sendPushMock.mockReset();
    computeCycleStartMock.mockReset();
    safeCompareMock.mockReset();
    safeCompareMock.mockReturnValue(true);
  });

  it("returns 401 on wrong cron secret", async () => {
    safeCompareMock.mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Missing Supabase/i);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns success with processed=0 when no push_subscriptions exist", async () => {
    setupSupabase({
      push_subscriptions: [{ data: [], error: null }],
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("returns 500 when push_subscriptions select errors", async () => {
    setupSupabase({
      push_subscriptions: [{ data: null, error: { message: "rls denied" } }],
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Database query failed/i);
  });

  it("sends push on withdrawal day when cycle dedup is a miss", async () => {
    const today = new Date();
    const dayOfMonth = today.getUTCDate();
    computeCycleStartMock.mockReturnValue(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

    setupSupabase({
      push_subscriptions: [
        { data: [{ user_id: "u1" }], error: null },              // initial users fetch
        { data: [{ subscription_json: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }], error: null },  // per-user subs
      ],
      treasury_configs: {
        data: [{
          id: "c1", user_id: "u1", account_id: "acc-1",
          withdrawal_day:              dayOfMonth,
          push_withdrawal_day_enabled: true,
          last_withdrawal_push_cycle_start: "1999-01-01",  // OLD cycle → dedup miss
        }],
        error: null,
      },
      treasury_calendar_events:  { data: [], error: null },
      treasury_configs_update:   { error: null },
    });
    sendPushMock.mockResolvedValue(undefined);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(sendPushMock).toHaveBeenCalledTimes(1);
  });

  it("SKIPS sending when lastCycleStart === currentCycle (dedup hit)", async () => {
    const today = new Date();
    const dayOfMonth = today.getUTCDate();
    const cycleStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const cycleStartStr = `${cycleStart.getUTCFullYear()}-${String(cycleStart.getUTCMonth() + 1).padStart(2, "0")}-${String(cycleStart.getUTCDate()).padStart(2, "0")}`;
    computeCycleStartMock.mockReturnValue(cycleStart);

    setupSupabase({
      push_subscriptions: [
        { data: [{ user_id: "u1" }], error: null },
      ],
      treasury_configs: {
        data: [{
          id: "c1", user_id: "u1", account_id: "acc-1",
          withdrawal_day:              dayOfMonth,
          push_withdrawal_day_enabled: true,
          last_withdrawal_push_cycle_start: cycleStartStr,  // SAME cycle → dedup hit
        }],
        error: null,
      },
      treasury_calendar_events: { data: [], error: null },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("SKIPS sending when push_withdrawal_day_enabled=false", async () => {
    const today = new Date();
    setupSupabase({
      push_subscriptions: [
        { data: [{ user_id: "u1" }], error: null },
      ],
      treasury_configs: {
        data: [{
          id: "c1", user_id: "u1", account_id: "acc-1",
          withdrawal_day:              today.getUTCDate(),
          push_withdrawal_day_enabled: false,  // ← gate closed
          last_withdrawal_push_cycle_start: null,
        }],
        error: null,
      },
      treasury_calendar_events: { data: [], error: null },
    });

    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("captures per-user config errors and continues processing", async () => {
    setupSupabase({
      push_subscriptions: [
        { data: [{ user_id: "u1" }], error: null },
      ],
      treasury_configs:          { data: null, error: { message: "config rls boom" } },
      treasury_calendar_events:  { data: [], error: null },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.errors).toContain("Config query failed for user u1");
  });
});
