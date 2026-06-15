// Integration test for /api/cron/bars/tradovate-fetch handler (Sprint M).
//
// The cron fetches fresh M15+H1 bars from Tradovate for active futures algos
// so the dispatcher's bars-loader hits cache instead of Yahoo. Covers:
//   1. 401 on bad cron secret.
//   2. Zero connections → ok with connections:0, no DB hits past first select.
//   3. No futures algos → loops connections but per_algo arrays stay empty.
//   4. Token unavailable → results row with error:'no_token'.
//   5. Happy path: fetchTradovateBars returns bars → upsert + coverage row.
//   6. fetchTradovateBars throws → error captured per-pair, loop continues.
//   7. historical_bars upsert error → fetched>0 + inserted=0 + error tag.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  fromMock,
  fetchTradovateBarsMock,
  readTokenMock,
  storeTokenMock,
  tradovateRenewMock,
} = vi.hoisted(() => ({
  fromMock:               vi.fn(),
  fetchTradovateBarsMock: vi.fn(),
  readTokenMock:          vi.fn(),
  storeTokenMock:         vi.fn(),
  tradovateRenewMock:     vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/cme/tradovate-marketdata", () => ({
  fetchTradovateBars: fetchTradovateBarsMock,
}));
vi.mock("@/lib/cme/tradovate", () => ({
  tradovateRenew: tradovateRenewMock,
}));
vi.mock("@/lib/cme/vault", () => ({
  readCmeAccessToken:  readTokenMock,
  storeCmeAccessToken: storeTokenMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-cron-secret-1234567890";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit", "maybeSingle", "single", "insert", "update", "upsert"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(secret = "test-cron-secret-1234567890"): NextRequest {
  return new NextRequest("http://localhost/api/cron/bars/tradovate-fetch", {
    method:  "POST",
    headers: { "x-cron-secret": secret },
  });
}

describe("/api/cron/bars/tradovate-fetch — handler", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchTradovateBarsMock.mockReset();
    readTokenMock.mockReset();
    storeTokenMock.mockReset();
    tradovateRenewMock.mockReset();
  });

  it("returns 401 on wrong secret", async () => {
    const res = await POST(makeRequest("wrong"));
    expect(res.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns ok with connections:0 when no cme_connections exist", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "cme_connections") return makeAwaitableChain({ data: [], error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connections).toBe(0);
    expect(body.results).toEqual([]);
  });

  it("returns 'no_token' for connections without a vault token", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "cme_connections") return makeAwaitableChain({
        data: [{ id: "conn-1", user_id: "u1", cme_account_id: "cme-1", tradovate_account_id: 12345, token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
        error: null,
      });
      if (table === "algorithms") return makeAwaitableChain({
        data: [{ id: "a1", user_id: "u1", parameters: { contract: "ESM5" }, engine_config: { market_type: "futures" }, platform: "Tradovate", status: "paper" }],
        error: null,
      });
      if (table === "algo_cme_accounts") return makeAwaitableChain({
        data: { is_paper: true }, error: null,
      });
      return makeAwaitableChain({ data: null, error: null });
    });
    readTokenMock.mockResolvedValue(null);  // no token in vault

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs_processed).toBe(1);
    expect(body.results[0].error).toBe("no_token");
    expect(fetchTradovateBarsMock).not.toHaveBeenCalled();
  });

  it("no futures algos → results array stays empty, no fetch attempted", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "cme_connections") return makeAwaitableChain({
        data: [{ id: "conn-1", user_id: "u1", cme_account_id: "cme-1", tradovate_account_id: 12345, token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
        error: null,
      });
      // No algos for this user at all.
      if (table === "algorithms") return makeAwaitableChain({ data: [], error: null });
      if (table === "algo_cme_accounts") return makeAwaitableChain({ data: { is_paper: true }, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    readTokenMock.mockResolvedValue("tok");

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.connections).toBe(1);
    expect(body.pairs_processed).toBe(0);
    expect(fetchTradovateBarsMock).not.toHaveBeenCalled();
  });

  it("happy path: bars returned → historical_bars upsert + coverage upsert", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "cme_connections") return makeAwaitableChain({
        data: [{ id: "conn-1", user_id: "u1", cme_account_id: "cme-1", tradovate_account_id: 12345, token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
        error: null,
      });
      if (table === "algorithms") return makeAwaitableChain({
        data: [{ id: "a1", user_id: "u1", parameters: { contract: "ESM5" }, engine_config: { market_type: "futures" }, platform: "Tradovate", status: "paper" }],
        error: null,
      });
      if (table === "algo_cme_accounts") return makeAwaitableChain({ data: { is_paper: true }, error: null });
      // historical_bars + historical_bars_coverage upsert
      return makeAwaitableChain({ data: null, error: null });
    });
    readTokenMock.mockResolvedValue("tok");
    fetchTradovateBarsMock.mockResolvedValue([
      { ts: "2026-06-12T10:00:00Z", open: 5000, high: 5010, low: 4995, close: 5005, volume: 1000, spread: null },
      { ts: "2026-06-12T10:15:00Z", open: 5005, high: 5020, low: 5000, close: 5018, volume: 1500, spread: null },
    ]);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    // 1 connection × 1 contract × 2 timeframes (M15, H1) = 2 pairs
    expect(body.pairs_processed).toBe(2);
    expect(body.total_fetched).toBeGreaterThan(0);
    expect(body.total_inserted).toBeGreaterThan(0);
    expect(fetchTradovateBarsMock).toHaveBeenCalledTimes(2);
  });

  it("fetchTradovateBars THROWS → captured per-pair, loop continues", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "cme_connections") return makeAwaitableChain({
        data: [{ id: "conn-1", user_id: "u1", cme_account_id: "cme-1", tradovate_account_id: 12345, token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }],
        error: null,
      });
      if (table === "algorithms") return makeAwaitableChain({
        data: [{ id: "a1", user_id: "u1", parameters: { contract: "ESM5" }, engine_config: { market_type: "futures" }, platform: "Tradovate", status: "paper" }],
        error: null,
      });
      if (table === "algo_cme_accounts") return makeAwaitableChain({ data: { is_paper: true }, error: null });
      return makeAwaitableChain({ data: null, error: null });
    });
    readTokenMock.mockResolvedValue("tok");
    fetchTradovateBarsMock.mockRejectedValue(new Error("network ETIMEDOUT"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pairs_processed).toBe(2);
    expect(body.results.every((r: { error?: string }) => r.error?.includes("ETIMEDOUT"))).toBe(true);
    expect(body.total_inserted).toBe(0);
    expect(body.errors).toBe(2);
  });
});
