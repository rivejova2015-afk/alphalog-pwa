// Integration test for /api/algorithms/[id]/telemetry GET handler (Wave 3
// item 12 — powers the live-refresh crypto telemetry panel, zero coverage).
//
// Covers: 401, 404 (algorithm not found), 404 (non-crypto market_type),
// 500 (coinarb_telemetry query error), telemetry:null (bot hasn't ticked
// yet — no 404), happy path field mapping (num/int coercion, regime
// allowlist, trades_by_symbol/caps from payload, defaults).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock:    vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "order", "limit", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/telemetry", { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

describe("/api/algorithms/[id]/telemetry — GET", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-crypto algorithms (own telemetry paths live elsewhere)", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: { id: "algo-1", market_type: "forex" }, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/only available for crypto/i);
  });

  it("returns 500 when the coinarb_telemetry query errors", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1", market_type: "crypto" }, error: null });
      return makeAwaitableChain({ data: null, error: { message: "rls denied" } });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(500);
  });

  it("returns telemetry:null (not 404) when the bot hasn't ticked yet", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1", market_type: "crypto" }, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.telemetry).toBeNull();
  });

  it("happy path: maps fields, coerces numbers, defaults caps, validates regime allowlist", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1", market_type: "crypto" }, error: null });
      return makeAwaitableChain({
        data: {
          equity_usd: "123.45", // string from DB numeric — must coerce
          available_balance_usd: 100,
          open_positions_count: "3",
          total_pnl_usd: 23.45,
          win_rate: 0.55,
          ws_coinbase_connected: true,
          ws_binance_connected: false,
          btc_spot_price: 65000,
          consecutive_losses: 0,
          daily_trades_count: 5,
          daily_wins: 3,
          daily_losses: 2,
          phase_current: "phase-1",
          risk_pct_current: 5,
          capital_current: 123.45,
          paused_until: null,
          last_heartbeat_at: "2026-07-03T00:00:00Z",
          payload: { regime: "TRENDING_HIGH", trades_by_symbol: { "BTC-USD": 3 }, total_cap: 50, per_symbol_cap: 10 },
        },
        error: null,
      });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.telemetry).toMatchObject({
      equityUsd: 123.45,
      openPositionsCount: 3,
      wsCoinbaseConnected: true,
      wsBinanceConnected: false,
      regime: "TRENDING_HIGH",
      tradesBySymbol: { "BTC-USD": 3 },
      totalCap: 50,
      perSymbolCap: 10,
    });
  });

  it("defaults totalCap=100/perSymbolCap=33 and regime=null when payload lacks them", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: { id: "algo-1", market_type: "crypto" }, error: null });
      return makeAwaitableChain({
        data: {
          equity_usd: 100, available_balance_usd: 100, open_positions_count: 0,
          total_pnl_usd: 0, win_rate: 0, ws_coinbase_connected: false, ws_binance_connected: false,
          btc_spot_price: null, consecutive_losses: 0, daily_trades_count: 0, daily_wins: 0,
          daily_losses: 0, phase_current: null, risk_pct_current: null, capital_current: 100,
          paused_until: null, last_heartbeat_at: "2026-07-03T00:00:00Z",
          payload: { regime: "not-a-real-regime" },
        },
        error: null,
      });
    });
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.telemetry.totalCap).toBe(100);
    expect(body.telemetry.perSymbolCap).toBe(33);
    expect(body.telemetry.regime).toBeNull(); // invalid regime string is rejected
  });
});
