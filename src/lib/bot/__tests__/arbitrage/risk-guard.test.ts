import { describe, it, expect, vi, beforeEach } from "vitest";
import { listExpiredPositions, isDailyCircuitOpen, type PairConfig } from "../../arbitrage/risk-guard";

const PAIR: PairConfig = {
  algorithm_id: "algo-1",
  user_id: "user-1",
  fast_bot_account_id: "fast-1",
  slow_bot_account_id: "slow-1",
  max_hold_seconds: 300,
  min_hold_seconds: 10,
};

interface MockState {
  positionsData: Array<{ id: string; ticket: number; open_time: string; bot_account_id: string }> | null;
}

// `algorithms` is in-scope (own Postgres) — isDailyCircuitOpen now reads it via
// getPgClient() instead of the injected `sb`. pgState/vi.mock below stand in
// for what used to be the `state.algoData` Supabase mock.
const pgState = vi.hoisted(() => ({
  algoData: null as { pnl_today: number | null; parameters?: unknown } | null,
}));

vi.mock("@/lib/pg/client", () => ({
  getPgClient: () => ({
    from(table: string) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        single() { return chain; },
        then(resolve: (v: unknown) => unknown) {
          if (table === "algorithms") {
            return resolve({ data: pgState.algoData, error: null });
          }
          return resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  }),
}));

let state: MockState;

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async maybeSingle() {
          return { data: null };
        },
        then(resolve: (v: unknown) => unknown) {
          // For bot_open_positions: terminal access without .maybeSingle()
          if (table === "bot_open_positions") {
            return resolve({ data: state.positionsData });
          }
          return resolve({ data: null });
        },
      };
      return chain;
    },
  };
}

describe("risk-guard", () => {
  beforeEach(() => {
    state = { positionsData: null };
    pgState.algoData = null;
  });

  describe("listExpiredPositions", () => {
    it("retorna [] cuando no hay posiciones abiertas", async () => {
      state.positionsData = [];
      const r = await listExpiredPositions(makeMockSupabase() as never, PAIR);
      expect(r).toEqual([]);
    });

    it("retorna [] cuando todas las posiciones están dentro de max_hold_seconds", async () => {
      state.positionsData = [
        { id: "p1", ticket: 111, open_time: new Date(Date.now() - 100_000).toISOString(), bot_account_id: "slow-1" },
      ];
      const r = await listExpiredPositions(makeMockSupabase() as never, PAIR);
      expect(r).toEqual([]);
    });

    it("retorna las posiciones que pasaron max_hold_seconds con age computado", async () => {
      state.positionsData = [
        { id: "p1", ticket: 111, open_time: new Date(Date.now() - 600_000).toISOString(), bot_account_id: "slow-1" }, // 600s > 300s
        { id: "p2", ticket: 222, open_time: new Date(Date.now() - 100_000).toISOString(), bot_account_id: "slow-1" }, // 100s < 300s
      ];
      const r = await listExpiredPositions(makeMockSupabase() as never, PAIR);
      expect(r).toHaveLength(1);
      expect(r[0].position_ref).toBe("111");
      expect(r[0].age_seconds).toBeGreaterThanOrEqual(600);
      expect(r[0].age_seconds).toBeLessThanOrEqual(601);
    });
  });

  describe("isDailyCircuitOpen", () => {
    it("retorna open=true cuando no se encuentra el algorithm", async () => {
      pgState.algoData = null;
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "missing-id");
      expect(r.open).toBe(true);
      expect(r.reason).toContain("not found");
    });

    it("retorna open=false cuando pnl_today está dentro del límite (porcentaje)", async () => {
      pgState.algoData = { pnl_today: -3 }; // -3% (porcentaje directo)
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", 0.05);
      expect(r.open).toBe(false);
    });

    it("retorna open=true cuando pnl_today <= -ddLimit (porcentaje)", async () => {
      pgState.algoData = { pnl_today: -6 }; // -6%
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", 0.05);
      expect(r.open).toBe(true);
      expect(r.reason).toContain("circuit breaker");
    });

    it("normaliza pnl_today cuando viene como fracción", async () => {
      pgState.algoData = { pnl_today: -0.06 }; // -6% como fracción
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", 0.05);
      expect(r.open).toBe(true);
    });

    it("respeta ddLimit custom", async () => {
      pgState.algoData = { pnl_today: -8 };
      // Con ddLimit 10%, -8% no dispara
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", 0.10);
      expect(r.open).toBe(false);
    });

    it("pnl_today no numérico se trata como 0", async () => {
      pgState.algoData = { pnl_today: null };
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", 0.05);
      expect(r.open).toBe(false);
    });
  });
});
