// Integration test for /api/algorithms/[id]/signal POST handler (Wave 3
// item 12 — the poll surface the MT4/MT5 EA hits every few seconds to ask
// "should I trade right now?". Zero coverage despite driving live order
// decisions).
//
// Covers: 401, 400 (invalid body), 404 (algorithm not found), platform
// guard (non-MT4/MT5 → HOLD wrong_platform), non-live status → HOLD,
// no instruments → HOLD no_symbol, single-symbol happy path, single-symbol
// engine error → HOLD engine_error, multi-symbol path (best-pick logic +
// per-symbol error isolation).

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, runEngineV1Mock } = vi.hoisted(() => ({
  getUserMock:     vi.fn(),
  fromMock:        vi.fn(),
  runEngineV1Mock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/engine/v1", () => ({
  runEngineV1: runEngineV1Mock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  POST = mod.POST;
});

function makeAwaitableChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "maybeSingle"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(body: unknown = {}): NextRequest {
  return new NextRequest("http://localhost/api/algorithms/algo-1/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    duplex: "half",
  });
}

const CTX = { params: Promise.resolve({ id: "algo-1" }) };

function setupAuth() {
  getUserMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
}

const BASE_ALGO = {
  id: "algo-1",
  user_id: "u1",
  name: "Test Algo",
  status: "live",
  platform: "MT5",
  engine_config: null,
  parameters: {},
  instrument: ["EURUSD"],
  lot_size: 0.01,
  risk_percent: 1,
};

function setupAlgo(overrides: Partial<typeof BASE_ALGO> | null = {}) {
  fromMock.mockReturnValue(
    makeAwaitableChain({ data: overrides === null ? null : { ...BASE_ALGO, ...overrides }, error: null }),
  );
}

describe("/api/algorithms/[id]/signal — POST", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    runEngineV1Mock.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "x" } });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid body (bad current_bar shape)", async () => {
    setupAuth();
    const res = await POST(makeRequest({ current_bar: { ts: "x" } }), CTX);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the algorithm is not found", async () => {
    setupAuth();
    setupAlgo(null);
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(404);
  });

  it("non-MT4/MT5 platform returns HOLD with wrong_platform reason (200, not error)", async () => {
    setupAuth();
    setupAlgo({ platform: "tradovate" });
    const res = await POST(makeRequest(), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("HOLD");
    expect(body.reason).toMatch(/^wrong_platform:tradovate/);
    expect(runEngineV1Mock).not.toHaveBeenCalled();
  });

  it("non-live status returns HOLD with algorithm_status reason", async () => {
    setupAuth();
    setupAlgo({ status: "paper" });
    const res = await POST(makeRequest(), CTX);
    const body = await res.json();
    expect(body.action).toBe("HOLD");
    expect(body.reason).toBe("algorithm_status:paper");
    expect(runEngineV1Mock).not.toHaveBeenCalled();
  });

  it("no instruments returns HOLD with no_symbol reason", async () => {
    setupAuth();
    setupAlgo({ instrument: [] });
    const res = await POST(makeRequest(), CTX);
    const body = await res.json();
    expect(body.action).toBe("HOLD");
    expect(body.reason).toBe("no_symbol");
  });

  it("single-symbol path: happy — merges engine signal with algorithm info", async () => {
    setupAuth();
    setupAlgo();
    runEngineV1Mock.mockResolvedValue({
      action: "BUY", lots: 0.02, confidence: 0.8, signalId: "sig-1", reason: "smc_ok", modules: [],
    });
    const res = await POST(makeRequest({ symbol: "EURUSD" }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("BUY");
    expect(body.algorithm).toMatchObject({ id: "algo-1", name: "Test Algo", status: "live" });
    expect(runEngineV1Mock).toHaveBeenCalledTimes(1);
  });

  it("single-symbol path: engine throws → HOLD engine_error (no 500)", async () => {
    setupAuth();
    setupAlgo();
    runEngineV1Mock.mockRejectedValue(new Error("engine boom"));
    const res = await POST(makeRequest({ symbol: "EURUSD" }), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("HOLD");
    expect(body.reason).toBe("engine_error");
  });

  it("multi-symbol path: no symbol in body evaluates all instruments and picks highest-confidence non-HOLD", async () => {
    setupAuth();
    setupAlgo({ instrument: ["EURUSD", "GBPUSD"] });
    runEngineV1Mock.mockImplementation((_sb, _algo, ctx: { symbol: string }) => {
      if (ctx.symbol === "EURUSD") {
        return Promise.resolve({ action: "HOLD", lots: 0, confidence: 0, signalId: "", reason: "no_setup", modules: [] });
      }
      return Promise.resolve({ action: "BUY", lots: 0.01, confidence: 0.9, signalId: "sig-2", reason: "smc_ok", modules: [] });
    });
    const res = await POST(makeRequest({}), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.multi).toBe(true);
    expect(body.signals).toHaveLength(2);
    expect(body.best.symbol).toBe("GBPUSD");
    expect(body.best.action).toBe("BUY");
  });

  it("multi-symbol path: one symbol's engine error is isolated (becomes HOLD, doesn't fail the batch)", async () => {
    setupAuth();
    setupAlgo({ instrument: ["EURUSD", "GBPUSD"] });
    runEngineV1Mock.mockImplementation((_sb, _algo, ctx: { symbol: string }) => {
      if (ctx.symbol === "EURUSD") return Promise.reject(new Error("boom"));
      return Promise.resolve({ action: "HOLD", lots: 0, confidence: 0, signalId: "", reason: "no_setup", modules: [] });
    });
    const res = await POST(makeRequest({}), CTX);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signals).toHaveLength(2);
    const eurRow = body.signals.find((s: { symbol: string }) => s.symbol === "EURUSD");
    expect(eurRow.action).toBe("HOLD");
    expect(eurRow.reason).toBe("engine_error");
  });
});
