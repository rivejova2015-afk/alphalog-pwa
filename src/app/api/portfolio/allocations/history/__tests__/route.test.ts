// Test para GET /api/portfolio/allocations/history.
//
// Covers:
//   1. 401 sin usuario autenticado.
//   2. Sin corridas → runs: [].
//   3. Agrupa filas por run_at en corridas distintas, ordenadas más
//      reciente primero, con nombre de algoritmo joineado.
//   4. Corta a MAX_RUNS corridas distintas.

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
  for (const m of ["select", "eq", "in", "order", "limit"]) {
    proxy[m] = () => proxy;
  }
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

describe("GET /api/portfolio/allocations/history", () => {
  it("401 sin usuario autenticado", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("sin corridas → runs: []", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "portfolio_allocations") return chain({ data: [], error: null });
      throw new Error(`unexpected table ${table}`);
    });
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ runs: [] });
  });

  it("agrupa filas por run_at en corridas distintas, más reciente primero", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockImplementation((table: string) => {
      if (table === "portfolio_allocations") {
        return chain({
          data: [
            { algorithm_id: "algo-1", weight: 0.6, run_at: "2026-07-06T04:00:00Z", lookback_days: 60 },
            { algorithm_id: "algo-2", weight: 0.4, run_at: "2026-07-06T04:00:00Z", lookback_days: 60 },
            { algorithm_id: "algo-1", weight: 0.5, run_at: "2026-06-29T04:00:00Z", lookback_days: 60 },
            { algorithm_id: "algo-2", weight: 0.5, run_at: "2026-06-29T04:00:00Z", lookback_days: 60 },
          ],
          error: null,
        });
      }
      if (table === "algorithms") {
        return chain({
          data: [
            { id: "algo-1", name: "ES Momentum" },
            { id: "algo-2", name: "Coinarb 50x" },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await GET();
    const json = await res.json();
    expect(json.runs).toHaveLength(2);
    expect(json.runs[0].runAt).toBe("2026-07-06T04:00:00Z");
    expect(json.runs[0].allocations).toEqual([
      { algorithmId: "algo-1", algorithmName: "ES Momentum", weight: 0.6 },
      { algorithmId: "algo-2", algorithmName: "Coinarb 50x", weight: 0.4 },
    ]);
    expect(json.runs[1].runAt).toBe("2026-06-29T04:00:00Z");
  });
});
