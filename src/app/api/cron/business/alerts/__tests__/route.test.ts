// Integration test for /api/cron/business/alerts GET handler.
//
// Daily cron that pushes low-runway + annual-report-due alerts. Covers:
//   1. 401 on wrong cron secret (timingSafeEqual).
//   2. 500 cuando faltan Supabase env vars.
//   3. results=[] cuando no hay llc_info rows.
//   4. 500 cuando llc_info select errors.
//   5. SKIPS user sin push_subscriptions (no push, no record).
//   6. SKIPS low-runway alert cuando ya hay business_alert_history row para
//      este month (dedup).
//   7. SKIPS annual-report alert cuando last_annual_report_push_year ya
//      coincide con el currentYear.
//   8. SKIPS annual-report cuando current month != annual_report_due_month.
//   9. Per-user trades/costs/subs query error logueado y loop continúa.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  sendPushMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  sendPushMock:     vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));
vi.mock("@/lib/push/webpush.server", () => ({
  sendPushToSubscriptions: sendPushMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-cron-secret-1234567890";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "limit", "update", "insert"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(secret = "test-cron-secret-1234567890"): NextRequest {
  return new NextRequest("http://localhost/api/cron/business/alerts", {
    method:  "GET",
    headers: { "x-cron-secret": secret },
  });
}

interface UserFixture {
  user_id:                      string;
  annual_report_due_month:      number | null;
  last_annual_report_push_year: number | null;
}

interface TableFixtures {
  llc_info?:                  { data: UserFixture[] | null; error: unknown };
  trades?:                    { data: unknown[] | null; error: unknown };
  business_costs?:            { data: unknown[] | null; error: unknown };
  push_subscriptions?:        { data: unknown[] | null; error: unknown };
  business_alert_history?:    { data: unknown[] | null; error: unknown };
}

function setupSupabase(fixtures: TableFixtures) {
  createClientMock.mockReturnValue({
    from: (table: string) => {
      const t = fixtures[table as keyof TableFixtures];
      if (t) return makeAwaitableChain({ data: t.data, error: t.error });
      return makeAwaitableChain({ data: null, error: null });
    },
  });
}

describe("/api/cron/business/alerts — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    sendPushMock.mockReset();
    sendPushMock.mockResolvedValue({ sent: 1, failed: 0 });
  });

  it("returns 401 on wrong cron secret", async () => {
    const res = await GET(makeRequest("wrong"));
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

  it("returns 200 + results=[] when there are no llc_info rows", async () => {
    setupSupabase({ llc_info: { data: [], error: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("returns 500 when llc_info select errors", async () => {
    setupSupabase({ llc_info: { data: null, error: { message: "rls denied" } } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to fetch users/i);
  });

  it("SKIPS user without push_subscriptions (no alerts sent)", async () => {
    setupSupabase({
      llc_info: { data: [{ user_id: "u1", annual_report_due_month: null, last_annual_report_push_year: null }], error: null },
      trades:                 { data: [],   error: null },
      business_costs:         { data: [],   error: null },
      push_subscriptions:     { data: [],   error: null },
      business_alert_history: { data: [],   error: null },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(sendPushMock).not.toHaveBeenCalled();
  });

  it("SKIPS low-runway alert when business_alert_history already has a row for this month", async () => {
    const now = new Date();
    const lastMonthCostDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

    setupSupabase({
      llc_info: { data: [{ user_id: "u1", annual_report_due_month: null, last_annual_report_push_year: null }], error: null },
      trades:                 { data: [], error: null },
      business_costs:         { data: [{ amount: 9000, cost_date: lastMonthCostDate }], error: null },  // burn but cashReserve=0 → runway < 3
      push_subscriptions:     { data: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }], error: null },
      business_alert_history: { data: [{ alert_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` }], error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    // Dedup: history row exists, no push sent.
    expect(sendPushMock).not.toHaveBeenCalled();
    expect(body.results).toEqual([]);
  });

  it("SKIPS annual-report alert when last_annual_report_push_year matches currentYear", async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    setupSupabase({
      llc_info: {
        data: [{ user_id: "u1", annual_report_due_month: currentMonth, last_annual_report_push_year: currentYear }],
        error: null,
      },
      trades:                 { data: [], error: null },
      business_costs:         { data: [], error: null },
      push_subscriptions:     { data: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }], error: null },
      // Pre-seed low_runway history so that branch dedupes too — otherwise
      // with avgBurn=0 the runway is 0 which trips the low-runway push and
      // pollutes this test's assertion.
      business_alert_history: { data: [{ alert_month: currentMonthStr }], error: null },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    // No annual_report push because last_annual_report_push_year already matches.
    const annualResults = ((await res.clone().json()).results as Array<{ alert_type: string }>).filter((r) => r.alert_type === "annual_report");
    expect(annualResults.length).toBe(0);
  });

  it("SKIPS annual-report alert when current month != annual_report_due_month", async () => {
    const now = new Date();
    const otherMonth = (now.getMonth() + 6) % 12 + 1;  // 6 months from now

    setupSupabase({
      llc_info: {
        data: [{ user_id: "u1", annual_report_due_month: otherMonth, last_annual_report_push_year: null }],
        error: null,
      },
      trades:                 { data: [], error: null },
      business_costs:         { data: [], error: null },
      push_subscriptions:     { data: [{ subscription: { endpoint: "x", keys: { auth: "a", p256dh: "p" } } }], error: null },
      business_alert_history: { data: [], error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results.filter((r: { alert_type: string }) => r.alert_type === "annual_report").length).toBe(0);
  });

  it("continues loop when per-user trades query errors", async () => {
    setupSupabase({
      llc_info: { data: [{ user_id: "u1", annual_report_due_month: null, last_annual_report_push_year: null }], error: null },
      trades:   { data: null, error: { message: "trades rls boom" } },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    // User was skipped, no results, but cron didn't 500.
    expect(body.results).toEqual([]);
  });
});
