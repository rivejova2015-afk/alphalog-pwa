import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks de Supabase y market-hours antes de importar el módulo bajo test
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => mockSupabase,
}));
vi.mock("../market-hours", () => ({
  isMarketHours: () => mockIsMarketHours(),
}));

const mockIsMarketHours = vi.fn(() => true);

type TableData = {
  cme_risk_configs?: { enabled: boolean; paused_reason?: string | null; circuit_breaker_pct: number; max_positions?: number | null } | null;
  algo_cme_accounts?: { max_daily_loss?: number | null; max_trailing_dd?: number | null; funded_amount?: number | null } | null;
  cme_positions?: Array<{ id: string; is_manual: boolean }>;
  cme_connections?: { daily_pnl_usd: number; status: string } | null;
  cme_equity_snapshots?: Array<{ equity_usd: number; snapshot_at: string }>;
};

let tableData: TableData = {};

const mockSupabase = {
  from(table: string) {
    const data = tableData[table as keyof TableData];
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: data ?? null }),
      // When the call ends without .maybeSingle() (e.g. cme_positions), the awaited result is the array
      then: (resolve: (v: unknown) => unknown) => resolve({ data: Array.isArray(data) ? data : (data ? [data] : []) }),
    };
    return chain;
  },
};

import { checkOrderRisk } from "../risk-manager";

const PARAMS = {
  userId: "user-1",
  cmeAccountId: "acc-1",
  direction: "BUY" as const,
  quantity: 1,
};

describe("risk-manager", () => {
  beforeEach(() => {
    mockIsMarketHours.mockReturnValue(true);
    tableData = {
      cme_risk_configs: { enabled: true, paused_reason: null, circuit_breaker_pct: 80, max_positions: 5 },
      algo_cme_accounts: { max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000 },
      cme_positions: [],
      cme_connections: { daily_pnl_usd: 0, status: "connected" },
      cme_equity_snapshots: [],
    };
  });

  describe("checkOrderRisk", () => {
    it("happy path: permite cuando todas las reglas pasan", async () => {
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("rechaza fuera de market hours", async () => {
      mockIsMarketHours.mockReturnValue(false);
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("outside_market_hours");
    });

    it("rechaza cuando risk_config.enabled = false", async () => {
      tableData.cme_risk_configs = { enabled: false, paused_reason: "manual", circuit_breaker_pct: 80, max_positions: 5 };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("manual");
    });

    it("rechaza cuando risk_config no existe", async () => {
      tableData.cme_risk_configs = null;
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("account_disabled");
    });

    it("rechaza cuando connection.status != 'connected'", async () => {
      tableData.cme_connections = { daily_pnl_usd: 0, status: "disconnected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("account_not_connected");
    });

    it("rechaza cuando hay posición manual abierta", async () => {
      tableData.cme_positions = [{ id: "pos-1", is_manual: true }];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("manual_position_active");
    });

    it("rechaza por circuit breaker cuando daily PnL <= -(max_daily_loss × cb_pct/100)", async () => {
      // max_daily_loss=1000, cb=80% → threshold = 800
      tableData.cme_connections = { daily_pnl_usd: -850, status: "connected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("circuit_breaker_threshold");
    });

    it("permite cuando daily PnL = -799 (justo bajo el threshold)", async () => {
      tableData.cme_connections = { daily_pnl_usd: -799, status: "connected" };
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("rechaza cuando posiciones abiertas >= max_positions", async () => {
      tableData.cme_positions = [
        { id: "p1", is_manual: false }, { id: "p2", is_manual: false },
        { id: "p3", is_manual: false }, { id: "p4", is_manual: false },
        { id: "p5", is_manual: false },
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_positions_reached");
    });

    it("permite cuando max_positions = null (ilimitado)", async () => {
      tableData.cme_risk_configs = { enabled: true, paused_reason: null, circuit_breaker_pct: 80, max_positions: null };
      tableData.cme_positions = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, is_manual: false }));
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    // Trailing drawdown — propfirm protection.
    it("rechaza cuando trailing DD desde el peak supera max_trailing_dd", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 2000, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 47000, snapshot_at: "2026-06-10T00:00:00Z" }, // actual (DESC)
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" }, // peak
        { equity_usd: 50000, snapshot_at: "2026-06-01T00:00:00Z" },
      ];
      // peak=52000, current=47000 → DD=5000 ≥ 2000 → bloqueado.
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_trailing_dd_breached");
    });

    it("permite cuando trailing DD está bajo el umbral", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 2000, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 51500, snapshot_at: "2026-06-10T00:00:00Z" }, // actual
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" }, // peak
      ];
      // peak=52000, current=51500 → DD=500 < 2000 → permite.
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("ignora trailing DD cuando max_trailing_dd es null", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: null, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 10000, snapshot_at: "2026-06-10T00:00:00Z" }, // dramatic loss, ignorado
        { equity_usd: 52000, snapshot_at: "2026-06-05T00:00:00Z" },
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(true);
    });

    it("usa funded_amount como peak inicial cuando no hay snapshots por encima", async () => {
      tableData.algo_cme_accounts = { max_daily_loss: 1000, max_trailing_dd: 1500, funded_amount: 50000 };
      tableData.cme_equity_snapshots = [
        { equity_usd: 48000, snapshot_at: "2026-06-10T00:00:00Z" }, // peak=funded=50000, DD=2000 ≥ 1500
      ];
      const r = await checkOrderRisk(PARAMS);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe("max_trailing_dd_breached");
    });
  });
});
