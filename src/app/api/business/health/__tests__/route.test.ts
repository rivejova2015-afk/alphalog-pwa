// Integration tests for GET /api/business/health.
//
// Covers:
//   1. 401 cuando auth falla.
//   2. 500 cuando falla el fetch de trades o business_costs.
//   3. Happy path: wiring correcto — llama a getLastNMonths/calculatePLMetrics/
//      calculateRunwayMetrics/calculateHealthAlerts con los datos correctos,
//      retorna {alerts, runway, plLast3} + Cache-Control.
//   4. RUNWAY_THRESHOLD_MONTHS ausente usa default 3 (constante de módulo,
//      así que se verifica sin env var seteada en vez de reimportar el módulo).
//
// La matemática real (calculatePLMetrics, etc.) ya está 100% unit-testeada en
// src/lib/business/__tests__/metrics.test.ts — acá solo se verifica el wiring
// de la ruta (auth, fetch, forma de la respuesta), por eso se mockean.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const {
  getUserMock,
  fromMock,
  calculatePLMetricsMock,
  calculateHealthAlertsMock,
  calculateRunwayMetricsMock,
  getLastNMonthsMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  calculatePLMetricsMock: vi.fn(),
  calculateHealthAlertsMock: vi.fn(),
  calculateRunwayMetricsMock: vi.fn(),
  getLastNMonthsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));
vi.mock("@/lib/business/metrics", () => ({
  calculatePLMetrics: (...args: unknown[]) => calculatePLMetricsMock(...args),
  calculateHealthAlerts: (...args: unknown[]) => calculateHealthAlertsMock(...args),
  calculateRunwayMetrics: (...args: unknown[]) => calculateRunwayMetricsMock(...args),
  getLastNMonths: (...args: unknown[]) => getLastNMonthsMock(...args),
}));
vi.mock("@/lib/log", () => ({ logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn() }));

let GET: () => Promise<Response>;
beforeAll(async () => {
  delete process.env.RUNWAY_THRESHOLD_MONTHS;
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

function authedUser(id = "u-1") {
  getUserMock.mockResolvedValue({ data: { user: { id } }, error: null });
}
function unauthed() {
  getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
}

describe("GET /api/business/health", () => {
  beforeEach(() => {
    getUserMock.mockReset();
    fromMock.mockReset();
    calculatePLMetricsMock.mockReset().mockReturnValue({ month: "2026-06", pnl: 0 });
    calculateHealthAlertsMock.mockReset().mockReturnValue([]);
    calculateRunwayMetricsMock.mockReset().mockReturnValue({ runwayMonths: 12 });
    getLastNMonthsMock.mockReset().mockReturnValue(["2026-04", "2026-05", "2026-06"]);
  });

  it("401 cuando auth falla", async () => {
    unauthed();
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("500 cuando falla el fetch de trades o business_costs", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "trades"
        ? makeSelectChain({ data: null, error: { message: "rls denied" } })
        : makeSelectChain({ data: [], error: null })
    );

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Fetch failed");
  });

  it("Happy path: wiring correcto, Cache-Control, default threshold=3", async () => {
    authedUser();
    fromMock.mockImplementation((table: string) =>
      table === "trades"
        ? makeSelectChain({ data: [{ id: "t1", account_id: "a1", entry_date: "2026-06-01", exit_date: "2026-06-02", pnl: 100, status: "Closed" }], error: null })
        : makeSelectChain({ data: [{ id: "c1", amount: 50, category: "Data" }], error: null })
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toEqual([]);
    expect(body.runway).toEqual({ runwayMonths: 12 });
    expect(body.plLast3).toHaveLength(3);
    expect(res.headers.get("Cache-Control")).toContain("private");

    expect(getLastNMonthsMock).toHaveBeenCalledWith(3);
    expect(calculatePLMetricsMock).toHaveBeenCalledTimes(3);
    expect(calculateRunwayMetricsMock).toHaveBeenCalledWith(
      [{ month: "2026-06", pnl: 0 }, { month: "2026-06", pnl: 0 }, { month: "2026-06", pnl: 0 }],
      0
    );
    // Default RUNWAY_THRESHOLD_MONTHS (env var no seteada) = 3
    expect(calculateHealthAlertsMock).toHaveBeenCalledWith(expect.any(Array), 12, 3);
  });
});
