// Integration test for /api/algorithms/[id]/connections GET handler.
//
// Covers Wave 2 item 11: crypto algorithms used to fall through the
// `["forex","futures","options"].includes(market_type)` allowlist and get
// silently treated as forex — returning a misleading "mt5: pending" block
// instead of real crypto pairing info. Now 'crypto' is recognized explicitly
// and reads coinarb_telemetry for connection status.

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
  const chainable = ["select", "eq", "is", "order", "limit", "maybeSingle", "single"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/connections", { method: "GET" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

describe("/api/algorithms/[id]/connections — GET", () => {
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
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: { message: "not found" } }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("forex algorithm without a linked bot_account returns mt5 block with paired=false", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "MT5 algo", market_type: "forex", instrument: "EURUSD", status: "live", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
      error: null,
    }));
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mt5).toMatchObject({ paired: false, connection_status: "pending" });
    expect(body.crypto).toBeNull();
    expect(body.cme).toBeNull();
  });

  it("crypto algorithm is recognized explicitly and reads coinarb_telemetry (not silently forex)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: { id: "algo-1", name: "Coinarb", market_type: "crypto", instrument: "BTC-USD", status: "live", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
          error: null,
        });
      }
      if (table === "coinarb_telemetry") {
        return makeAwaitableChain({
          data: { ws_coinbase_connected: true, ws_binance_connected: false, last_heartbeat_at: new Date().toISOString() },
          error: null,
        });
      }
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm.market_type).toBe("crypto");
    // The bug this closes: crypto must NOT be coerced into the mt5 block.
    expect(body.mt5).toBeNull();
    expect(body.cme).toBeNull();
    expect(body.crypto).toMatchObject({
      agent_id: "algo-1",
      paired: true,
      ws_coinbase_connected: true,
      ws_binance_connected: false,
      connection_status: "live",
    });
  });

  it("crypto algorithm with no telemetry row yet returns paired=false, connection_status=pending", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "algorithms") {
        return makeAwaitableChain({
          data: { id: "algo-1", name: "Coinarb", market_type: "crypto", instrument: "BTC-USD", status: "paper", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
          error: null,
        });
      }
      return makeAwaitableChain({ data: null, error: null });
    });
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.crypto).toMatchObject({ paired: false, connection_status: "pending" });
  });

  it("unrecognized market_type falls back to forex (existing default preserved)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "?", market_type: "something-new", instrument: "X", status: "draft", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
      error: null,
    }));
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.algorithm.market_type).toBe("forex");
    expect(body.mt5).not.toBeNull();
  });

  it("options market_type returns { available: false }", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "Opt", market_type: "options", instrument: "SPX", status: "draft", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
      error: null,
    }));
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.options).toEqual({ available: false });
    expect(body.crypto).toBeNull();
  });
});
