import { describe, it, expect, beforeEach } from "vitest";
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
  algoData: { pnl_today: number | null; parameters?: unknown } | null;
  telemetryData: { equity: number | null } | null;
}

let state: MockState;

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async maybeSingle() {
          if (table === "algorithms") return { data: state.algoData };
          if (table === "bot_telemetry") return { data: state.telemetryData };
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
    state = { positionsData: null, algoData: null, telemetryData: null };
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
      state.algoData = null;
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "missing-id", "slow-bot-1");
      expect(r.open).toBe(true);
      expect(r.reason).toContain("not found");
    });

    it("pnl_today es siempre dólares — un valor chico (ej. -75.25) NO se malinterpreta como -75%", async () => {
      // Regresión del bug: antes Math.abs(-75.25) <= 1 era falso → se dividía
      // por 100 y se leía como -0.75 (-75%), disparando el breaker en falso.
      state.algoData = { pnl_today: -75.25 };
      state.telemetryData = { equity: 50_000 }; // -75.25 / 50000 = -0.15%, trivial
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(false);
    });

    it("una pérdida chica en dólares (ej. -0.50) tampoco se lee como -50%", async () => {
      state.algoData = { pnl_today: -0.5 };
      state.telemetryData = { equity: 10_000 };
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(false);
    });

    it("retorna open=true cuando el drawdown real (pnl_today/equity) supera ddLimit", async () => {
      state.algoData = { pnl_today: -600 };
      state.telemetryData = { equity: 10_000 }; // -6%
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(true);
      expect(r.reason).toContain("circuit breaker");
    });

    it("respeta ddLimit custom", async () => {
      state.algoData = { pnl_today: -800 };
      state.telemetryData = { equity: 10_000 }; // -8%
      // Con ddLimit 10%, -8% no dispara
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.10);
      expect(r.open).toBe(false);
    });

    it("pnl_today no numérico se trata como 0 (no dispara)", async () => {
      state.algoData = { pnl_today: null };
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(false);
    });

    it("sin telemetry.equity disponible no se puede normalizar a % — no dispara (fail-open)", async () => {
      state.algoData = { pnl_today: -5000 };
      state.telemetryData = null;
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(false);
    });

    it("pnl_today positivo nunca dispara, sin necesidad de consultar equity", async () => {
      state.algoData = { pnl_today: 500 };
      const r = await isDailyCircuitOpen(makeMockSupabase() as never, "algo-1", "slow-bot-1", 0.05);
      expect(r.open).toBe(false);
    });
  });
});
