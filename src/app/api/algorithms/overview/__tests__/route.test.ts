// Integration test for /api/algorithms/overview GET handler (Wave 5 item
// 21 — the first cross-market P&L/exposure aggregation endpoint).
//
// Covers: 401, 500 (algorithms query error), zero-algorithms (all-zero
// totals, no crash), forex aggregation via bot_telemetry, futures
// aggregation via algo_cme_accounts → cme_equity_snapshots/cme_positions
// (latest snapshot per account, not a naive sum), and the combined totals
// across both markets. Crypto (Coinarb) aggregation was removed 2026-07-14
// along with the bot itself.

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

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/overview", { method: "GET" });
}

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

describe("/api/algorithms/overview — GET", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 500 when the algorithms query errors", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: { message: "rls denied" } }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns all-zero totals when the user has no algorithms", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") return makeAwaitableChain({ data: [], error: null });
      return makeAwaitableChain({ data: [], error: null });
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual({ algorithmCount: 0, equityUsd: 0, pnlUsd: 0, openPositions: 0 });
    expect(body.byMarket).toHaveLength(2);
  });

  it("aggregates forex via bot_telemetry (equity, equity-balance as pnl proxy, positions_total)", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: [{ id: "algo-1", market_type: "forex", linked_bot_account_id: "ba-1", parameters: {} }],
          error: null,
        });
      }
      if (table === "bot_telemetry") {
        return makeAwaitableChain({ data: [{ equity: 10500, balance: 10000, positions_total: 2 }], error: null });
      }
      return makeAwaitableChain({ data: [], error: null });
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    const forex = body.byMarket.find((m: { marketType: string }) => m.marketType === "forex");
    expect(forex).toMatchObject({ algorithmCount: 1, equityUsd: 10500, pnlUsd: 500, openPositions: 2 });
  });

  it("aggregates futures — resolves cme_account_num → algo_cme_accounts, uses latest snapshot per account (not a sum of history)", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: [{ id: "algo-1", market_type: "futures", linked_bot_account_id: null, parameters: { cme_account_num: "TSX-777" } }],
          error: null,
        });
      }
      if (table === "algo_cme_accounts") {
        return makeAwaitableChain({ data: [{ id: "cme-acc-9" }], error: null });
      }
      if (table === "cme_equity_snapshots") {
        // Two snapshots for the same account, newest first — only the first should count.
        return makeAwaitableChain({
          data: [
            { cme_account_id: "cme-acc-9", equity_usd: 52000, snapshot_at: "2026-07-03T12:00:00Z" },
            { cme_account_id: "cme-acc-9", equity_usd: 50000, snapshot_at: "2026-07-02T12:00:00Z" },
          ],
          error: null,
        });
      }
      if (table === "cme_positions") {
        return makeAwaitableChain({ data: [{ unrealized_pnl_usd: 120 }, { unrealized_pnl_usd: -20 }], error: null });
      }
      return makeAwaitableChain({ data: [], error: null });
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    const futures = body.byMarket.find((m: { marketType: string }) => m.marketType === "futures");
    expect(futures).toMatchObject({ algorithmCount: 1, equityUsd: 52000, pnlUsd: 100, openPositions: 2 });
  });

  it("combines totals across both markets", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: [
            { id: "a1", market_type: "forex", linked_bot_account_id: "ba-1", parameters: {} },
          ],
          error: null,
        });
      }
      if (table === "bot_telemetry") return makeAwaitableChain({ data: [{ equity: 1000, balance: 900, positions_total: 1 }], error: null });
      return makeAwaitableChain({ data: [], error: null });
    });
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.totals).toEqual({ algorithmCount: 1, equityUsd: 1000, pnlUsd: 100, openPositions: 1 });
  });
});
