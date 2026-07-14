// Integration test for /api/cron/algorithms/tradovate-poll handler.
//
// Validates the Sprint S Globex-closed short-circuit:
//   1. When Globex is closed, the handler returns skipped='globex_closed'
//      WITHOUT touching the database (zero supabase calls).
//   2. When Globex is open + no algos exist, returns ok with zero counts.
//   3. SKIP_MARKET_HOURS_CHECK=true bypass — the cron runs even on Sat.
//
// All external dependencies are mocked at the module level. Cross-references:
//   - src/lib/cme/market-hours.test.ts covers isGlobexOpen() in isolation
//   - This file covers the handler's integration of that helper
//
// Auth uses timingSafeEqual against CRON_SECRET — we set it in beforeAll.

import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { pgFromMock, supabaseFromMock, isGlobexOpenMock, getDispatchModeMock, dispatchSignalMock, runEngineV1Mock } = vi.hoisted(() => ({
  // algorithms is a migrated table (getPgClient) — supabaseFromMock stays
  // scoped to historical_bars only, per the hybrid-file split (Task 7 of the
  // CME/Tradovate migration plan).
  pgFromMock:          vi.fn(),
  supabaseFromMock:    vi.fn(),
  isGlobexOpenMock:    vi.fn(),
  getDispatchModeMock: vi.fn(() => "shadow"),
  dispatchSignalMock:  vi.fn(),
  runEngineV1Mock:     vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: supabaseFromMock }),
}));
vi.mock("@/lib/pg/client", () => ({
  getPgClient: () => ({ from: pgFromMock }),
}));
vi.mock("@/lib/cme/market-hours", () => ({
  isGlobexOpen: isGlobexOpenMock,
}));
vi.mock("@/lib/engine/dispatchers/index", () => ({
  getDispatchMode: getDispatchModeMock,
  dispatchSignal:  dispatchSignalMock,
}));
vi.mock("@/lib/engine/v1/index", () => ({
  runEngineV1: runEngineV1Mock,
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
  logInfo:  vi.fn(),
  logWarn:  vi.fn(),
}));

// Late import so the mocks are wired BEFORE the route module evaluates.
let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-cron-secret-1234567890";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(secret = "test-cron-secret-1234567890"): NextRequest {
  return new NextRequest("http://localhost/api/cron/algorithms/tradovate-poll", {
    method:  "POST",
    headers: { "x-cron-secret": secret },
  });
}

describe("/api/cron/algorithms/tradovate-poll — handler", () => {
  beforeEach(() => {
    pgFromMock.mockReset();
    supabaseFromMock.mockReset();
    isGlobexOpenMock.mockReset();
    getDispatchModeMock.mockReset().mockReturnValue("shadow");
    dispatchSignalMock.mockReset();
    runEngineV1Mock.mockReset();
    delete process.env.SKIP_MARKET_HOURS_CHECK;
  });

  afterEach(() => {
    delete process.env.SKIP_MARKET_HOURS_CHECK;
  });

  it("returns 401 when the cron secret is missing or wrong", async () => {
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    // Should NEVER reach Globex check or DB on auth fail.
    expect(isGlobexOpenMock).not.toHaveBeenCalled();
    expect(pgFromMock).not.toHaveBeenCalled();
  });

  it("short-circuits with skipped='globex_closed' when market is closed", async () => {
    isGlobexOpenMock.mockReturnValue(false);

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("shadow");
    expect(body.skipped).toBe("globex_closed");
    expect(body.counts.algosScanned).toBe(0);
    expect(body.per_algo).toEqual([]);
    // Globex check WAS called, but DB was NOT touched.
    expect(isGlobexOpenMock).toHaveBeenCalledOnce();
    expect(pgFromMock).not.toHaveBeenCalled();
  });

  it("proceeds when SKIP_MARKET_HOURS_CHECK=true even if Globex closed", async () => {
    process.env.SKIP_MARKET_HOURS_CHECK = "true";
    isGlobexOpenMock.mockReturnValue(false);

    // Empty algos list so the loop is a no-op.
    pgFromMock.mockReturnValue({
      select: () => ({
        in: () => ({
          in: () => ({
            is: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBeUndefined();
    expect(body.counts.algosScanned).toBe(0);
    // DB WAS touched once for the algorithms select, via the pg shim.
    expect(pgFromMock).toHaveBeenCalledWith("algorithms");
  });

  it("returns ok with zero counts when Globex is open and no algos exist", async () => {
    isGlobexOpenMock.mockReturnValue(true);

    pgFromMock.mockReturnValue({
      select: () => ({
        in: () => ({
          in: () => ({
            is: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBeUndefined();
    expect(body.counts).toEqual({
      algosScanned: 0,
      placed:       0,
      shadowLogged: 0,
      skipped:      0,
      failed:       0,
      noSymbol:     0,
    });
    expect(body.per_algo).toEqual([]);
    expect(body.mode).toBe("shadow");
  });

  it("returns 500 when the algorithms select errors out", async () => {
    isGlobexOpenMock.mockReturnValue(true);

    pgFromMock.mockReturnValue({
      select: () => ({
        in: () => ({
          in: () => ({
            is: () => Promise.resolve({ data: null, error: { message: "boom" } }),
          }),
        }),
      }),
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("boom");
    expect(body.mode).toBe("shadow");
  });
});
