// Integration tests for GET /api/business/kpis.
//
// Covers:
//   1. 401 cuando auth falla.
//   2. 500 cuando falla el fetch de trades o business_costs.
//   3. ?month= válido (YYYY-MM): se pasa tal cual a calculateKPIMetrics.
//   4. ?month= inválido: cae a getMonthStr() (mes actual), NO 400.
//   5. Happy path sin ?month=: usa getMonthStr() directamente.
//
// La matemática real (calculateKPIMetrics) ya está 100% unit-testeada en
// src/lib/business/__tests__/metrics.test.ts — acá solo se verifica wiring.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserMock, fromMock, calculateKPIMetricsMock, getMonthStrMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  calculateKPIMetricsMock: vi.fn(),
  getMonthStrMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/business/metrics", () => ({
  calculateKPIMetrics: (...args: unknown[]) => calculateKPIMetricsMock(...args),
  getMonthStr: (...args: unknown[]) => getMonthStrMock(...args),
}));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

let GET: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function makeSelectChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "ilike"];
  for (const m of methods) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeRequest(query?: string): NextRequest {
  return new NextRequest(`http://localhost/api/business/kpis${query ? "?" + query : ""}`);
}

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/kpis", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    calculateKPIMetricsMock.mockReset().mockReturnValue({ consistency: 0.5 });
    getMonthStrMock.mockReset().mockReturnValue("2026-07");
    fromMock.mockImplementation((table: string) =>
      table === "trades"
        ? makeSelectChain({ data: [], error: null })
        : makeSelectChain({ data: [], error: null })
    );
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("500 cuando falla el fetch de trades o business_costs", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "trades"
        ? makeSelectChain({ data: null, error: { message: "rls denied" } })
        : makeSelectChain({ data: [], error: null })
    );
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("?month= válido (YYYY-MM) se pasa tal cual, NO usa getMonthStr()", async () => {
    authedUser();
    const res = await GET(makeRequest("month=2026-03"));
    expect(res.status).toBe(200);
    expect(calculateKPIMetricsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), "2026-03");
  });

  it("?month= inválido cae a getMonthStr(), NO 400", async () => {
    authedUser();
    const res = await GET(makeRequest("month=not-a-month"));
    expect(res.status).toBe(200);
    expect(calculateKPIMetricsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), "2026-07");
  });

  it("Happy path sin ?month=: usa getMonthStr(), retorna {kpis} + Cache-Control", async () => {
    authedUser();
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kpis).toEqual({ consistency: 0.5 });
    expect(res.headers.get("Cache-Control")).toContain("private");
    expect(calculateKPIMetricsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), "2026-07");
  });
});
