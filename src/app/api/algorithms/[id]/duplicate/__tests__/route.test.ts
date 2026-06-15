// Integration test for /api/algorithms/[id]/duplicate POST handler.
//
// Endpoint clones an existing algorithm preserving config but resetting all
// operational state. Covers:
//   1. 401 when unauthenticated.
//   2. 429 when rate limit exceeded (30/hr).
//   3. 404 when the source algorithm is not found.
//   4. 500 when the insert errors.
//   5. Happy path "no existing copy": new name has " (copia)".
//   6. Happy path "with collisions": new name has " (copia 2)" / "(copia 3)".
//   7. clone payload resets operational state to zeros + status='draft'.
//   8. clone payload preserves config (parameters, engine_config, instrument).
//   9. audit log fires with action='create' on success.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  getUserMock,
  fromMock,
  checkRateLimitMock,
  logAuditMock,
} = vi.hoisted(() => ({
  getUserMock:        vi.fn(),
  fromMock:           vi.fn(),
  checkRateLimitMock: vi.fn(),
  logAuditMock:       vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/security/aiRateLimit", () => ({
  checkAiRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/security/auditLog", () => ({
  logAuditFromRequest: logAuditMock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

// Specialized chain builder for duplicate. The handler does, in order:
//   1. SELECT * FROM algorithms (source)
//   2. SELECT name FROM algorithms (existing copies — for uniqueCopyName)
//   3. INSERT INTO algorithms (returns the new row)
function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "ilike", "single", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeInsertChain(result: { data?: unknown; error?: unknown }, capture?: (payload: unknown) => void) {
  const proxy: Record<string, unknown> = {};
  proxy.insert = (payload: unknown) => { capture?.(payload); return proxy; };
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/duplicate", { method: "POST" });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

const SOURCE_ROW = {
  id:                 "algo-1",
  user_id:            "u1",
  name:               "ES strategy",
  instrument:         "ES",
  market_type:        "futures",
  direction:          "long",
  platform:           "Tradovate",
  status:             "paper",
  linked_bot_account_id: "ba-1",
  lot_size:           1,
  max_trades:         5,
  risk_percent:       2,
  parameters:         { contract: "ESM5", contracts_per_trade: 2 },
  engine_config:      { market_type: "futures" },
  scan_config:        { scan: true },
  default_backtest_balance: 25_000,
  // operational state (should be reset)
  pnl_today:          150,
  pnl_total:          5000,
  win_rate:           0.6,
  trade_count:        42,
  profit_factor:      1.8,
  drawdown_pct:       0.05,
  max_drawdown_pct:   0.12,
};

function setupAuth(allowed = true) {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  checkRateLimitMock.mockResolvedValue({ allowed, retryAfterSeconds: allowed ? null : 3600 });
}

describe("/api/algorithms/[id]/duplicate — handler", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    checkRateLimitMock.mockReset();
    logAuditMock.mockReset();
  });

  it("returns 401 when auth fails", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limit exceeded with the right headers", async () => {
    setupAuth(false);
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3600");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("30");
  });

  it("returns 404 when the source algorithm is not found", async () => {
    setupAuth();
    fromMock.mockReturnValue(makeAwaitableChain({ data: null, error: null }));
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("returns 500 when the INSERT errors", async () => {
    setupAuth();
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({ data: [], error: null });
      // Third call = the INSERT
      return makeInsertChain({ data: null, error: { message: "constraint violation" } });
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("constraint violation");
  });

  it("names the first copy '<name> (copia)' when no collisions exist", async () => {
    setupAuth();
    let capturedPayload: unknown = null;
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({ data: [], error: null });  // no existing copies
      return makeInsertChain(
        { data: { id: "algo-2", name: "ES strategy (copia)", status: "draft" }, error: null },
        (p) => { capturedPayload = p as Record<string, unknown>; },
      );
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(201);
    expect((capturedPayload as Record<string, unknown>)?.name).toBe("ES strategy (copia)");
  });

  it("bumps to '(copia 2)' when a '(copia)' already exists", async () => {
    setupAuth();
    let capturedPayload: unknown = null;
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({
        data: [{ name: "ES strategy (copia)" }], error: null,
      });
      return makeInsertChain(
        { data: { id: "algo-2", name: "ES strategy (copia 2)", status: "draft" }, error: null },
        (p) => { capturedPayload = p as Record<string, unknown>; },
      );
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(201);
    expect((capturedPayload as Record<string, unknown>)?.name).toBe("ES strategy (copia 2)");
  });

  it("bumps further to '(copia 3)' when '(copia)' + '(copia 2)' both exist", async () => {
    setupAuth();
    let capturedPayload: unknown = null;
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({
        data: [{ name: "ES strategy (copia)" }, { name: "ES strategy (copia 2)" }],
        error: null,
      });
      return makeInsertChain(
        { data: { id: "algo-2", name: "ES strategy (copia 3)", status: "draft" }, error: null },
        (p) => { capturedPayload = p as Record<string, unknown>; },
      );
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(201);
    expect((capturedPayload as Record<string, unknown>)?.name).toBe("ES strategy (copia 3)");
  });

  it("resets operational state to zeros and forces status='draft'", async () => {
    setupAuth();
    let capturedPayload: unknown = null;
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({ data: [], error: null });
      return makeInsertChain(
        { data: { id: "algo-2", name: "x", status: "draft" }, error: null },
        (p) => { capturedPayload = p as Record<string, unknown>; },
      );
    });
    await POST(makeRequest(), CTX);
    expect(capturedPayload as Record<string, unknown>).toMatchObject({
      status:                "draft",
      linked_bot_account_id: null,
      pnl_today:             0,
      pnl_total:             0,
      win_rate:              0,
      trade_count:           0,
      profit_factor:         0,
      drawdown_pct:          0,
      max_drawdown_pct:      0,
    });
  });

  it("preserves config (parameters, engine_config, instrument, default_backtest_balance)", async () => {
    setupAuth();
    let capturedPayload: unknown = null;
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({ data: [], error: null });
      return makeInsertChain(
        { data: { id: "algo-2", name: "x", status: "draft" }, error: null },
        (p) => { capturedPayload = p as Record<string, unknown>; },
      );
    });
    await POST(makeRequest(), CTX);
    expect((capturedPayload as Record<string, unknown>)?.parameters).toEqual(SOURCE_ROW.parameters);
    expect((capturedPayload as Record<string, unknown>)?.engine_config).toEqual(SOURCE_ROW.engine_config);
    expect((capturedPayload as Record<string, unknown>)?.instrument).toBe(SOURCE_ROW.instrument);
    expect((capturedPayload as Record<string, unknown>)?.default_backtest_balance).toBe(25_000);
    expect((capturedPayload as Record<string, unknown>)?.market_type).toBe("futures");
    expect((capturedPayload as Record<string, unknown>)?.platform).toBe("Tradovate");
  });

  it("happy path: 201 + audit log with action='create'", async () => {
    setupAuth();
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) return makeAwaitableChain({ data: SOURCE_ROW, error: null });
      if (call === 2) return makeAwaitableChain({ data: [], error: null });
      return makeInsertChain(
        { data: { id: "algo-2", name: "ES strategy (copia)", status: "draft" }, error: null },
      );
    });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.algorithm.id).toBe("algo-2");
    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      action: "create",
      resourceType: "algorithm",
      resourceId: "algo-2",
    });
  });
});
