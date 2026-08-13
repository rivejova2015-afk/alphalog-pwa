// Integration test for /api/algorithms/[id]/connections GET handler.
//
// Covers Wave 2 item 11 (crypto algorithms used to fall through the
// forex/futures/options allowlist and get silently treated as forex —
// fixed by explicit crypto recognition reading coinarb_telemetry). Coinarb
// was retired 2026-07-14; 'crypto' now falls into the same { available:
// false } "options" bucket as any other unrecognized market_type, rather
// than a misleading forex/MT5 block or a dead coinarb_telemetry read.

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
    expect(body.cme).toBeNull();
  });

  it("unrecognized market_type falls back to options { available: false }", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "?", market_type: "something-new", instrument: "X", status: "draft", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
      error: null,
    }));
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.algorithm.market_type).toBe("options");
    expect(body.mt5).toBeNull();
    expect(body.options).toEqual({ available: false });
  });

  it("crypto market_type falls back to options { available: false } (Coinarb retired 2026-07-14)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    fromMock.mockReturnValue(makeAwaitableChain({
      data: { id: "algo-1", name: "Coinarb", market_type: "crypto", instrument: "BTC-USD", status: "draft", parameters: {}, linked_bot_account_id: null, platform: "MT5" },
      error: null,
    }));
    const res = await GET(makeRequest(), CTX);
    const body = await res.json();
    expect(body.algorithm.market_type).toBe("options");
    expect(body.mt5).toBeNull();
    expect(body.options).toEqual({ available: false });
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
  });
});
