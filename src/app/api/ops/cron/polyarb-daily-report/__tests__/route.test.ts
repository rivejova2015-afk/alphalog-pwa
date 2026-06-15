// Integration test for /api/ops/cron/polyarb-daily-report POST handler.
//
// Cron diario que genera P&L summary por agente PolyArb + push notification.
// Covers:
//   1. 401 cuando validateBearerToken rechaza (OPS_CRON_SECRET inválido).
//   2. 500 cuando faltan Supabase env vars.
//   3. reports=0 cuando polyarb_agents retorna [].
//   4. Happy path single agent → reports=1, app_logs.insert con area
//      'polyarb_daily_report' + meta correcta.
//   5. Multi-agent → reports=2, 2 app_logs inserts.
//   6. totalPnl agregación: pnls [+50, -20, +100] → today_pnl=130, wins=2.
//   7. Telemetry null fallback: equity cae a starting_capital_usd.
//   8. Push fetch failure non-blocking → response sigue ok=true.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  validateBearerMock,
} = vi.hoisted(() => ({
  createClientMock:    vi.fn(),
  validateBearerMock:  vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/security/timing", () => ({ validateBearerToken: validateBearerMock }));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.OPS_CRON_SECRET = "ops-secret";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.alphalog.io";
  process.env.INTERNAL_API_SECRET = "internal-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ops/cron/polyarb-daily-report", {
    method: "POST",
    headers: { authorization: "Bearer ops-secret" },
  });
}

interface AgentRow      { id: string; user_id: string; name: string; status: string; starting_capital_usd: number }
interface TradeRow      { price: number; size: number; fee_usd: number; status: string; side: string }
interface PositionRow   { pnl_usd: number; pnl_percent: number; exit_reason: string }
interface TelemetryRow  { equity_usd: number; total_pnl_usd: number; win_rate: number; max_drawdown_pct: number }

interface AppLogInsert  { user_id: string; level: string; area: string; message: string; meta: Record<string, unknown> }

function setupSupabase({
  agents = [],
  tradesByAgent = {},
  positionsByAgent = {},
  telemetryByAgent = {},
}: {
  agents?:             AgentRow[];
  tradesByAgent?:      Record<string, TradeRow[]>;
  positionsByAgent?:   Record<string, PositionRow[]>;
  telemetryByAgent?:   Record<string, TelemetryRow | null>;
}) {
  const appLogInserts: AppLogInsert[] = [];

  createClientMock.mockReturnValue({
    from: (table: string) => {
      if (table === "polyarb_agents") {
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.is     = () => proxy;
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: agents, error: null }).then(resolve);
        return proxy;
      }
      if (table === "polyarb_trades") {
        let currentAgent: string | null = null;
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.is     = () => proxy;
        proxy.gte    = () => proxy;
        proxy.eq = (col: string, val: string) => {
          if (col === "agent_id") currentAgent = val;
          return proxy;
        };
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: tradesByAgent[currentAgent ?? ""] ?? [], error: null }).then(resolve);
        return proxy;
      }
      if (table === "polyarb_positions") {
        let currentAgent: string | null = null;
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.is     = () => proxy;
        proxy.gte    = () => proxy;
        proxy.in     = () => proxy;
        proxy.eq = (col: string, val: string) => {
          if (col === "agent_id") currentAgent = val;
          return proxy;
        };
        proxy.then = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: positionsByAgent[currentAgent ?? ""] ?? [], error: null }).then(resolve);
        return proxy;
      }
      if (table === "polyarb_telemetry") {
        let currentAgent: string | null = null;
        const proxy: Record<string, unknown> = {};
        proxy.select = () => proxy;
        proxy.eq = (col: string, val: string) => {
          if (col === "agent_id") currentAgent = val;
          return proxy;
        };
        proxy.single = () => {
          const tele = telemetryByAgent[currentAgent ?? ""];
          return Promise.resolve({ data: tele ?? null, error: tele ? null : { code: "PGRST116" } });
        };
        return proxy;
      }
      if (table === "app_logs") {
        const proxy: Record<string, unknown> = {};
        proxy.insert = (row: unknown) => {
          appLogInserts.push(row as AppLogInsert);
          return Promise.resolve({ error: null });
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

  return { appLogInserts };
}

describe("/api/ops/cron/polyarb-daily-report — handler", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    validateBearerMock.mockReset();
    validateBearerMock.mockReturnValue({ ok: true });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;
  });

  it("returns 401 when validateBearerToken rejects", async () => {
    validateBearerMock.mockReturnValue({ ok: false, error: "Unauthorized", status: 401 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("returns 500 when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/Missing config/i);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  it("returns reports=0 when polyarb_agents is empty", async () => {
    setupSupabase({ agents: [] });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reports).toBe(0);
  });

  it("happy path single agent: reports=1 + app_logs insert with correct meta", async () => {
    const { appLogInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "PolyArb-Aggressive", status: "RUNNING", starting_capital_usd: 1000 }],
      tradesByAgent: { a1: [
        { price: 0.5, size: 100, fee_usd: 0.1, status: "FILLED", side: "BUY" },
        { price: 0.6, size: 100, fee_usd: 0.1, status: "FILLED", side: "SELL" },
        { price: 0.55, size: 50, fee_usd: 0.05, status: "FILLED", side: "BUY" },
      ] },
      positionsByAgent: { a1: [
        { pnl_usd: 75, pnl_percent: 7.5, exit_reason: "TP" },
        { pnl_usd: -25, pnl_percent: -2.5, exit_reason: "SL" },
      ] },
      telemetryByAgent: { a1: { equity_usd: 1050, total_pnl_usd: 50, win_rate: 60, max_drawdown_pct: 5 } },
    });

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.reports).toBe(1);

    expect(appLogInserts).toHaveLength(1);
    const log = appLogInserts[0];
    expect(log.area).toBe("polyarb_daily_report");
    expect(log.user_id).toBe("u1");
    expect(log.meta).toMatchObject({
      agent_id:     "a1",
      equity:       1050,
      today_pnl:    50,
      trade_count:  3,
      closed_count: 2,
      wins:         1,
    });
  });

  it("multi-agent: 2 agents → reports=2 + 2 app_logs inserts", async () => {
    const { appLogInserts } = setupSupabase({
      agents: [
        { id: "a1", user_id: "u1", name: "Bot 1", status: "RUNNING", starting_capital_usd: 1000 },
        { id: "a2", user_id: "u1", name: "Bot 2", status: "RUNNING", starting_capital_usd: 2000 },
      ],
      tradesByAgent:    { a1: [], a2: [] },
      positionsByAgent: { a1: [], a2: [] },
      telemetryByAgent: { a1: null, a2: null },
    });

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(body.reports).toBe(2);
    expect(appLogInserts).toHaveLength(2);
    expect(appLogInserts.map((l) => l.meta.agent_id)).toEqual(["a1", "a2"]);
  });

  it("totalPnl aggregation: pnls [+50, -20, +100] → today_pnl=130, wins=2", async () => {
    const { appLogInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "X", status: "RUNNING", starting_capital_usd: 1000 }],
      positionsByAgent: { a1: [
        { pnl_usd: 50,  pnl_percent: 5,   exit_reason: "TP" },
        { pnl_usd: -20, pnl_percent: -2,  exit_reason: "SL" },
        { pnl_usd: 100, pnl_percent: 10,  exit_reason: "TP" },
      ] },
      telemetryByAgent: { a1: { equity_usd: 1130, total_pnl_usd: 130, win_rate: 66, max_drawdown_pct: 2 } },
    });

    await POST(makeRequest());
    expect(appLogInserts[0].meta).toMatchObject({
      today_pnl:    130,
      closed_count: 3,
      wins:         2,
    });
  });

  it("telemetry null fallback: equity cae a starting_capital_usd; summary muestra N/A", async () => {
    const { appLogInserts } = setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "X", status: "RUNNING", starting_capital_usd: 5000 }],
      telemetryByAgent: { a1: null },
    });

    await POST(makeRequest());
    const log = appLogInserts[0];
    expect(log.meta.equity).toBe(5000);
    expect(log.message).toMatch(/Win Rate: N\/A%/);
    expect(log.message).toMatch(/Max Drawdown: N\/A%/);
  });

  it("push fetch failure is non-blocking — response stays {ok:true, reports:N}", async () => {
    setupSupabase({
      agents: [{ id: "a1", user_id: "u1", name: "X", status: "RUNNING", starting_capital_usd: 1000 }],
      telemetryByAgent: { a1: null },
    });
    // Push endpoint throws → the handler's catch swallows it.
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network ECONNREFUSED")) as unknown as typeof fetch;

    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.reports).toBe(1);
  });
});
