// Integration test for /api/cron/business/recurring-costs GET handler.
//
// Daily cron that generates business_costs from active templates. Covers:
//   1. 401 cuando cron secret falla (timing-safe).
//   2. 500 cuando faltan Supabase env vars.
//   3. 200 + results=[] cuando no hay active templates.
//   4. 500 cuando business_cost_templates select errors.
//   5. SKIPS template cuando start_month > currentMonth.
//   6. SKIPS template cuando last_generated_month === currentMonth.
//   7. SKIPS template cuando business_costs ya tiene un cost para este mes.
//   8. action='error' cuando existing-costs check tira.
//   9. action='error' cuando insert tira; last_generated_month NO se actualiza.
//  10. action='error' (con cost_id) cuando insert OK pero update template falla.
//  11. Happy path: action='created', cost insertado + template updated, summary
//      counters reflejan created/skipped/errors.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  safeCompareMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  safeCompareMock:  vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/security/timing", () => ({ safeCompareTokens: safeCompareMock }));
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
  const chainable = ["select", "eq", "is", "order", "like", "limit", "update"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.single = () => Promise.resolve(result);
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

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/business/recurring-costs", {
    method:  "GET",
    headers: { "x-cron-secret": "test-secret" },
  });
}

interface TmplFixture {
  id: string; user_id: string;
  amount: number; category: string; description: string; vendor: string;
  day_of_month: number; start_month: string; active: boolean;
  last_generated_month: string | null;
}

function thisMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(): string {
  const n = new Date();
  const m = n.getMonth() + 1;  // 0-based + 1 = next 1-based
  const y = m === 12 ? n.getFullYear() + 1 : n.getFullYear();
  const adj = m === 12 ? 1 : m + 1;
  return `${y}-${String(adj).padStart(2, "0")}`;
}

interface SupabaseFixtures {
  templates?:               { data: TmplFixture[] | null; error: unknown };
  existingCosts?:           { data: unknown[] | null; error: unknown };
  insertResult?:            { data: { id: string } | null; error: unknown };
  updateTemplateError?:     { message: string } | null;
}

function setupSupabase(f: SupabaseFixtures) {
  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "business_cost_templates") {
        // Two surfaces: SELECT (top-level list) + UPDATE (per-template). The
        // chain proxy supports both via the .update() method on the same proxy.
        const proxy: Record<string, unknown> = {};
        const chainable = ["select", "eq", "is", "order", "like", "limit"];
        for (const m of chainable) proxy[m] = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(f.templates ?? { data: [], error: null }).then(resolve);
        proxy.update = () => {
          const up: Record<string, unknown> = {};
          for (const m of ["eq", "is"]) up[m] = () => up;
          up.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ error: f.updateTemplateError ?? null }).then(resolve);
          return up;
        };
        return proxy;
      }
      if (table === "business_costs") {
        // Two surfaces: SELECT (existing-costs probe) + INSERT (new cost).
        const proxy: Record<string, unknown> = {};
        const chainable = ["select", "eq", "is", "like", "limit"];
        for (const m of chainable) proxy[m] = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve(f.existingCosts ?? { data: [], error: null }).then(resolve);
        proxy.insert = () => {
          const ins = makeInsertChain(f.insertResult ?? { data: { id: "new-cost-1" }, error: null });
          return ins;
        };
        return proxy;
      }
      return makeAwaitableChain({ data: null, error: null });
    },
  });
}

const BASE_TMPL: TmplFixture = {
  id: "t1", user_id: "u1",
  amount: 100, category: "Software", description: "Rent", vendor: "Acme",
  day_of_month: 1, start_month: "2026-01", active: true,
  last_generated_month: null,
};

describe("/api/cron/business/recurring-costs — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns 200 + results=[] when there are no active templates", async () => {
    setupSupabase({ templates: { data: [], error: null } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.message).toMatch(/No active templates/i);
  });

  it("returns 500 when business_cost_templates select errors", async () => {
    setupSupabase({ templates: { data: null, error: { message: "rls boom" } } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Failed to fetch templates/i);
  });

  it("SKIPS template when start_month > currentMonth", async () => {
    setupSupabase({
      templates: { data: [{ ...BASE_TMPL, start_month: nextMonth() }], error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("skipped");
    expect(body.results[0].reason).toMatch(/Start month .* not yet reached/i);
    expect(body.summary).toMatchObject({ created: 0, skipped: 1, errors: 0 });
  });

  it("SKIPS template when last_generated_month === currentMonth", async () => {
    setupSupabase({
      templates: { data: [{ ...BASE_TMPL, last_generated_month: thisMonth() }], error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("skipped");
    expect(body.results[0].reason).toMatch(/Already generated/i);
  });

  it("SKIPS template when an existing cost is found for this month (safety check)", async () => {
    setupSupabase({
      templates:     { data: [BASE_TMPL], error: null },
      existingCosts: { data: [{ id: "existing-1" }], error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("skipped");
    expect(body.results[0].reason).toMatch(/Cost already exists/i);
  });

  it("action='error' when the existing-costs check tira", async () => {
    setupSupabase({
      templates:     { data: [BASE_TMPL], error: null },
      existingCosts: { data: null, error: { message: "probe rls" } },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("error");
    expect(body.results[0].reason).toMatch(/Failed to check existing costs/i);
    expect(body.summary).toMatchObject({ created: 0, errors: 1 });
  });

  it("action='error' when insert tira; no cost_id, no last_generated_month update", async () => {
    setupSupabase({
      templates:     { data: [BASE_TMPL], error: null },
      existingCosts: { data: [],          error: null },
      insertResult:  { data: null, error: { message: "constraint X" } },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("error");
    expect(body.results[0].reason).toMatch(/Failed to create cost/i);
    expect(body.results[0].cost_id).toBeUndefined();
  });

  it("action='error' WITH cost_id when insert OK but template update falls", async () => {
    setupSupabase({
      templates:           { data: [BASE_TMPL], error: null },
      existingCosts:       { data: [],          error: null },
      insertResult:        { data: { id: "new-cost-1" }, error: null },
      updateTemplateError: { message: "concurrent update" },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0].action).toBe("error");
    expect(body.results[0].cost_id).toBe("new-cost-1");
    expect(body.results[0].reason).toMatch(/Cost created but failed to update template/i);
  });

  it("happy path: creates the cost + bumps summary counters", async () => {
    setupSupabase({
      templates:    { data: [BASE_TMPL], error: null },
      existingCosts:{ data: [],          error: null },
      insertResult: { data: { id: "new-cost-1" }, error: null },
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      action:      "created",
      template_id: "t1",
      cost_id:     "new-cost-1",
    });
    expect(body.summary).toMatchObject({ created: 1, skipped: 0, errors: 0, total: 1 });
    expect(body.currentMonth).toBe(thisMonth());
  });
});
