// Integration test para /api/cron/portfolio/rebalance POST handler.
//
// Cron semanal que recalcula pesos HRP entre los algoritmos activos
// (paper/live) de cada usuario, usando retornos diarios reales. Covers:
//   1. 401 sin x-cron-secret válido.
//   2. Sin algoritmos → 0 resultados.
//   3. <2 algos con actividad suficiente → not_enough_algorithms, no toca
//      la asignación vigente.
//   4. ≥2 algos calificados → corre HRP, marca vieja is_current=false,
//      inserta nueva con is_current=true.
//   5. Multi-usuario: cada user_id se procesa independientemente.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const loadAlgorithmReturnsMock = vi.fn();
const hrpAllocateMock = vi.fn();

vi.mock("@/lib/portfolio/returns", async () => {
  const actual = await vi.importActual<typeof import("@/lib/portfolio/returns")>("@/lib/portfolio/returns");
  return {
    ...actual,
    loadAlgorithmReturns: (...args: unknown[]) => loadAlgorithmReturnsMock(...args),
  };
});
vi.mock("@/lib/portfolio/hrp", () => ({
  hrpAllocate: (...args: unknown[]) => hrpAllocateMock(...args),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

interface AlgoRow {
  id: string; user_id: string; name: string; market_type: string;
  parameters: Record<string, unknown>; status: string;
}

let algorithms: AlgoRow[] = [];
const updateCalls: Array<{ payload: Record<string, unknown> }> = [];
const insertCalls: Array<{ payload: unknown }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "algorithms") {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: algorithms, error: null }),
            }),
          }),
        };
      }
      if (table === "portfolio_allocations") {
        return {
          update: (payload: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                updateCalls.push({ payload });
                return { error: null };
              },
            }),
          }),
          insert: async (payload: unknown) => {
            insertCalls.push({ payload });
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(secret = "test-secret"): NextRequest {
  return new NextRequest("http://localhost/api/cron/portfolio/rebalance", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
}

function algo(overrides: Partial<AlgoRow> = {}): AlgoRow {
  return {
    id: "algo-1", user_id: "user-1", name: "Algo 1",
    market_type: "futures", parameters: {}, status: "live",
    ...overrides,
  };
}

describe("POST /api/cron/portfolio/rebalance", () => {
  beforeEach(() => {
    algorithms = [];
    updateCalls.length = 0;
    insertCalls.length = 0;
    loadAlgorithmReturnsMock.mockReset();
    hrpAllocateMock.mockReset();
  });

  it("401 sin x-cron-secret válido", async () => {
    const res = await POST(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("sin algoritmos → 0 usuarios procesados", async () => {
    algorithms = [];
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ users: 0, results: [] });
  });

  it("<2 algos con actividad suficiente → not_enough_algorithms, no inserta ni actualiza", async () => {
    algorithms = [algo({ id: "a1" }), algo({ id: "a2" })];
    // a1 tiene actividad, a2 no (todo ceros → countActiveDays=0 < MIN_ACTIVE_DAYS)
    loadAlgorithmReturnsMock
      .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => ({ date: `d${i}`, returnPct: 0.01 })))
      .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => ({ date: `d${i}`, returnPct: 0 })));

    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json.results[0]).toMatchObject({ userId: "user-1", ran: false, reason: "not_enough_algorithms", algorithmCount: 1 });
    expect(hrpAllocateMock).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
  });

  it("≥2 algos calificados → corre HRP, marca vieja asignación no-vigente, inserta la nueva", async () => {
    algorithms = [algo({ id: "a1" }), algo({ id: "a2" })];
    loadAlgorithmReturnsMock.mockImplementation(() =>
      Promise.resolve(Array.from({ length: 15 }, (_, i) => ({ date: `d${i}`, returnPct: 0.01 * (i % 3) }))),
    );
    hrpAllocateMock.mockReturnValue([
      { label: "a1", weight: 0.6 },
      { label: "a2", weight: 0.4 },
    ]);

    const res = await POST(makeRequest());
    const json = await res.json();

    expect(json.results[0]).toMatchObject({ userId: "user-1", ran: true, algorithmCount: 2 });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toMatchObject({ is_current: false });
    expect(insertCalls).toHaveLength(1);
    const rows = insertCalls[0].payload as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ user_id: "user-1", algorithm_id: "a1", weight: 0.6, is_current: true });
    expect(rows[1]).toMatchObject({ user_id: "user-1", algorithm_id: "a2", weight: 0.4, is_current: true });
  });

  it("multi-usuario: cada user_id se procesa de forma independiente", async () => {
    algorithms = [
      algo({ id: "a1", user_id: "user-1" }),
      algo({ id: "a2", user_id: "user-1" }),
      algo({ id: "b1", user_id: "user-2" }),
    ];
    loadAlgorithmReturnsMock.mockImplementation(() =>
      Promise.resolve(Array.from({ length: 15 }, (_, i) => ({ date: `d${i}`, returnPct: 0.01 }))),
    );
    hrpAllocateMock.mockReturnValue([{ label: "x", weight: 1 }]);

    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json.users).toBe(2);
    // user-2 solo tiene 1 algo → not_enough_algorithms.
    const user2Result = json.results.find((r: { userId: string }) => r.userId === "user-2");
    expect(user2Result).toMatchObject({ ran: false, reason: "not_enough_algorithms" });
  });
});
