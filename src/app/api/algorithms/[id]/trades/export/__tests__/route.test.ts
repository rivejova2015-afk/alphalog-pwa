// Integration test for /api/algorithms/[id]/trades/export GET handler
// (Wave 5 item 24 — CSV-only export, PDF explicitly skipped due to the
// documented @react-pdf/renderer 3.4.5 / React 19 incompatibility already
// hit once in this repo, see src/lib/polyarb/archive.tsx).
//
// Covers: 401, 404 (algorithm not found), forex branch (algorithm_trades),
// futures branch (resolves cme_account_num → algo_cme_accounts →
// propfirm/real table), futures with no linked CME account (empty CSV, not
// an error), unsupported market_type → 400 (covers 'options' and 'crypto'
// — Coinarb export support was removed 2026-07-14 along with the bot).

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
  return new NextRequest("http://localhost/api/algorithms/algo-1/trades/export", { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

describe("/api/algorithms/[id]/trades/export — GET", () => {
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

  it("forex: exports algorithm_trades as CSV with the expected filename", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({ data: { id: "algo-1", name: "Gold Bot", market_type: "forex", parameters: {} }, error: null });
      }
      if (table === "algorithm_trades") {
        return makeAwaitableChain({
          data: [{ id: "t1", direction: "BUY", instrument: "XAUUSD", entry_price: 2000, exit_price: 2010, lots: 0.1, duration_min: 30, pnl: 10, status: "closed", opened_at: "2026-01-01", closed_at: "2026-01-01" }],
          error: null,
        });
      }
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("Gold_Bot-trades.csv");
    const body = await res.text();
    expect(body).toContain("id,direction,instrument");
    expect(body).toContain("t1,BUY,XAUUSD");
  });

  it("futures: resolves cme_account_num → algo_cme_accounts → propfirm table", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: { id: "algo-1", name: "ES Bot", market_type: "futures", parameters: { cme_account_num: "TSX-777" } },
          error: null,
        });
      }
      if (table === "algo_cme_accounts") {
        return makeAwaitableChain({ data: { id: "cme-acc-9", account_type: "propfirm" }, error: null });
      }
      if (table === "cme_trades_propfirm") {
        return makeAwaitableChain({
          data: [{ id: "ct1", contract: "MESZ25", direction: "BUY", quantity: 1, fill_price: 5900, status: "closed", pnl_usd: 20, commission_usd: 2, slippage_ticks: 0, close_reason: "tp", fill_timestamp: "2026-01-01" }],
          error: null,
        });
      }
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("ct1,MESZ25,BUY");
  });

  it("futures: no linked CME account returns an empty (header-only) CSV, not an error", async () => {
    setupAuth();
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({ data: { id: "algo-1", name: "ES Bot", market_type: "futures", parameters: {} }, error: null });
      }
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body.trim()).toBe("id,contract,direction,quantity,fill_price,status,pnl_usd,commission_usd,slippage_ticks,close_reason,fill_timestamp");
  });

  it("returns 400 for an unsupported market_type", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: { id: "algo-1", name: "X", market_type: "options", parameters: {} }, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 400 for market_type=crypto (Coinarb export removed 2026-07-14)", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: { id: "algo-1", name: "Coinarb", market_type: "crypto", parameters: {} }, error: null }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(400);
  });
});
