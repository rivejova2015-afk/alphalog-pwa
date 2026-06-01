import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// server-only is stubbed in vitest.config.ts via alias
// supabase server import isn't exercised by the pure builder tests; we only
// test the synchronous logic.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { buildOperationsDashboard, type OperationsDashboardInput } from "../operationsDashboard";
import type { BusinessCost } from "../types";

// Mid-month fixed date so makeCost(daysAgo=1) always lands in the same
// calendar month as buildOperationsDashboard's currentMonth filter.
// Without this, day-1-of-month runs see costs dated to the prior month
// and filterCostsByMonth drops them → netPnlMonth = 0 instead of the
// expected negative. CURRENT_MONTH_STR is derived after setSystemTime
// in beforeEach so it always matches the faked clock.
const FIXED_NOW = new Date(2026, 5, 15); // 2026-06-15
let CURRENT_MONTH_STR = "";

function makeCost(amount: number, daysAgo = 1): BusinessCost {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    id: `cost-${Math.random()}`,
    user_id: "u1",
    amount,
    category: "Tools Software",
    description: "test",
    vendor: "test-vendor",
    cost_date: d.toISOString().slice(0, 10),
    is_recurring_instance: false,
    template_id: null,
    sort_index: 0,
    created_at: d.toISOString(),
    updated_at: d.toISOString(),
    deleted_at: null,
  };
}

function emptyInput(overrides: Partial<OperationsDashboardInput> = {}): OperationsDashboardInput {
  return {
    decisions: [],
    sopsTotal: 0,
    sopRunsThisMonthSopIds: [],
    milestonesPending: 0,
    monthCosts: [],
    trades: [],
    cashReserve: 0,
    ...overrides,
  };
}

describe("buildOperationsDashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const now = new Date();
    CURRENT_MONTH_STR = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  describe("decisionsPending", () => {
    it("retorna 0 cuando todas las decisions tienen 0 tasks pendientes", () => {
      const r = buildOperationsDashboard(emptyInput({
        decisions: [
          { id: "d1", pendingTaskCount: 0 },
          { id: "d2", pendingTaskCount: 0 },
        ],
      }));
      expect(r.decisionsPending).toBe(0);
    });

    it("cuenta sólo decisions con >0 tasks pendientes", () => {
      const r = buildOperationsDashboard(emptyInput({
        decisions: [
          { id: "d1", pendingTaskCount: 3 },
          { id: "d2", pendingTaskCount: 0 },
          { id: "d3", pendingTaskCount: 1 },
        ],
      }));
      expect(r.decisionsPending).toBe(2);
    });

    it("array vacío → 0", () => {
      expect(buildOperationsDashboard(emptyInput()).decisionsPending).toBe(0);
    });
  });

  describe("sopsToRun", () => {
    it("sopsTotal − distinct sopRunsThisMonth", () => {
      const r = buildOperationsDashboard(emptyInput({
        sopsTotal: 5,
        sopRunsThisMonthSopIds: ["s1", "s2"],
      }));
      expect(r.sopsToRun).toBe(3);
    });

    it("deduplica sopRunsThisMonthSopIds (varias runs del mismo SOP cuentan como 1)", () => {
      const r = buildOperationsDashboard(emptyInput({
        sopsTotal: 4,
        sopRunsThisMonthSopIds: ["s1", "s1", "s1", "s2"],
      }));
      expect(r.sopsToRun).toBe(2); // 4 - 2 distinct
    });

    it("clamp a 0 si runs > total (e.g. SOP eliminado después de un run)", () => {
      const r = buildOperationsDashboard(emptyInput({
        sopsTotal: 1,
        sopRunsThisMonthSopIds: ["s1", "s2", "s3"],
      }));
      expect(r.sopsToRun).toBe(0);
    });

    it("sin SOPs configurados → 0", () => {
      const r = buildOperationsDashboard(emptyInput({ sopsTotal: 0, sopRunsThisMonthSopIds: [] }));
      expect(r.sopsToRun).toBe(0);
    });
  });

  describe("costsTotalMonth", () => {
    it("suma todos los amounts del array", () => {
      const r = buildOperationsDashboard(emptyInput({
        monthCosts: [makeCost(100), makeCost(50), makeCost(25)],
      }));
      expect(r.costsTotalMonth).toBe(175);
    });

    it("ignora amounts null tratándolos como 0", () => {
      const c = makeCost(100);
      (c as { amount: number | null }).amount = null;
      const r = buildOperationsDashboard(emptyInput({
        monthCosts: [makeCost(50), c],
      }));
      expect(r.costsTotalMonth).toBe(50);
    });

    it("array vacío → 0", () => {
      expect(buildOperationsDashboard(emptyInput()).costsTotalMonth).toBe(0);
    });
  });

  describe("milestonesPending", () => {
    it("pasa through directamente", () => {
      const r = buildOperationsDashboard(emptyInput({ milestonesPending: 7 }));
      expect(r.milestonesPending).toBe(7);
    });
  });

  describe("netPnlMonth", () => {
    it("trades vacíos + costs vacíos → 0", () => {
      const r = buildOperationsDashboard(emptyInput());
      expect(r.netPnlMonth).toBe(0);
    });

    it("PnL positivo del mes actual sin costos → netIncome > 0", () => {
      // calculatePLMetrics filtra trades por mes vía exit_date YYYY-MM
      const trade = {
        id: "t1",
        account_id: "a1",
        pnl: 500,
        exit_date: `${CURRENT_MONTH_STR}-15`,
        status: "closed",
      } as never;
      const r = buildOperationsDashboard(emptyInput({ trades: [trade] }));
      expect(r.netPnlMonth).toBe(500);
    });

    it("netPnl resta los costos del mes (incluso si PnL es 0)", () => {
      const r = buildOperationsDashboard(emptyInput({
        monthCosts: [makeCost(100), makeCost(50)],
      }));
      expect(r.netPnlMonth).toBe(-150);
    });
  });

  describe("runwayMonths", () => {
    it("sin burn → Infinity en runway (helper retorna 0 cuando burn=0)", () => {
      // calculateRunwayMetrics retorna runwayMonths=0 cuando avgMonthlyBurn=0 (proteje contra div/0)
      const r = buildOperationsDashboard(emptyInput({ cashReserve: 10_000 }));
      expect(r.runwayMonths).toBe(0); // sin costos previos → no se puede estimar
    });

    it("con burn y cash → runway proporcional", () => {
      const costs = Array.from({ length: 3 }, () => makeCost(1_000));
      const r = buildOperationsDashboard(emptyInput({
        monthCosts: costs,
        cashReserve: 6_000,
      }));
      // avgBurn promedio del último mes (los del current) → 3000; cash 6000 → 2 meses
      // Pero calculateRunwayMetrics promedia los últimos 3 meses; los meses anteriores
      // sin costos darán burn=0, así que el promedio se diluye.
      // Verificamos que runwayMonths sea finito y > 0
      expect(r.runwayMonths).toBeGreaterThan(0);
      expect(Number.isFinite(r.runwayMonths)).toBe(true);
    });
  });

  describe("cashReserve", () => {
    it("pasa through directamente", () => {
      const r = buildOperationsDashboard(emptyInput({ cashReserve: 1234.56 }));
      expect(r.cashReserve).toBe(1234.56);
    });
  });

  describe("integration: dashboard completo", () => {
    it("retorna las 7 propiedades esperadas", () => {
      const r = buildOperationsDashboard(emptyInput({
        decisions: [{ id: "d1", pendingTaskCount: 2 }],
        sopsTotal: 3,
        sopRunsThisMonthSopIds: ["s1"],
        milestonesPending: 4,
        monthCosts: [makeCost(200)],
        trades: [],
        cashReserve: 5000,
      }));
      expect(r).toMatchObject({
        decisionsPending: 1,
        sopsToRun: 2,
        milestonesPending: 4,
        costsTotalMonth: 200,
        netPnlMonth: -200,
        cashReserve: 5000,
      });
      expect(typeof r.runwayMonths).toBe("number");
    });
  });
});
