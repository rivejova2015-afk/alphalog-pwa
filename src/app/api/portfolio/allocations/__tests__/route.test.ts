// Integration test para /api/portfolio/allocations GET.
//
// Covers:
//   1. 401 sin usuario autenticado.
//   2. Sin asignación vigente → allocations:[], runAt:null.
//   3. Con asignación → devuelve nombre + market_type joineados, ordenado
//      por weight desc, con Cache-Control header.
//   4. Error de supabase en la query de allocations → 500.

import { describe, it, expect, vi, beforeAll } from "vitest";

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

let GET: () => Promise<Response>;
beforeAll(async () => {
  const mod = await import("../route");
  GET = mod.GET;
});

function chain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) {
    proxy[m] = () => proxy;
  }
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

describe("GET /api/portfolio/allocations", () => {
  it("401 sin usuario autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("sin asignación vigente → allocations vacío", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "portfolio_allocations") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ allocations: [], runAt: null, lookbackDays: null });
  });

  it("con asignación → joinea nombre + market_type, incluye Cache-Control", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "portfolio_allocations") {
        return chain({
          data: [
            { id: "row-1", algorithm_id: "algo-1", weight: 0.7, daily_return_stdev: 0.01, run_at: "2026-07-01T00:00:00Z", lookback_days: 60 },
            { id: "row-2", algorithm_id: "algo-2", weight: 0.3, daily_return_stdev: 0.02, run_at: "2026-07-01T00:00:00Z", lookback_days: 60 },
          ],
          error: null,
        });
      }
      if (table === "algorithms") {
        return chain({
          data: [
            { id: "algo-1", name: "ES Momentum", market_type: "futures" },
            { id: "algo-2", name: "Coinarb 50x", market_type: "crypto" },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET();
    const json = await res.json();
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30, stale-while-revalidate=60");
    expect(json.runAt).toBe("2026-07-01T00:00:00Z");
    expect(json.lookbackDays).toBe(60);
    expect(json.allocations).toEqual([
      { algorithmId: "algo-1", algorithmName: "ES Momentum", marketType: "futures", weight: 0.7, dailyReturnStdev: 0.01 },
      { algorithmId: "algo-2", algorithmName: "Coinarb 50x", marketType: "crypto", weight: 0.3, dailyReturnStdev: 0.02 },
    ]);
  });

  it("error de supabase → 500", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "portfolio_allocations") return chain({ data: null, error: { message: "db down" } });
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
