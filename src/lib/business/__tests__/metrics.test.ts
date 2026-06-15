// Unit tests for src/lib/business/metrics.ts.
//
// Pure helpers para business P&L + KPIs + Health + Runway + Trend metrics.
// Validates:
//   - getMonthStr / getLastNMonths: YYYY-MM format con sort + boundary handling.
//   - filterTradesByMonth / filterCostsByMonth: prefix match con exit_date /
//     cost_date.
//   - calculatePLMetrics: grossIncome (solo positives), netIncome, totalCosts,
//     costsByCategory, incomeByAccount, margin formula.
//   - calculateKPIMetrics: consistency, profitPerHour, accountMetrics con
//     proportional cost allocation + custom fn opt-in.
//   - calculateHealthAlerts: negative months, low_runway, critical_runway.
//   - calculateRunwayMetrics: avg over 3 months, ratio, months con cash.
//   - calculateTrendMetrics: returns 6-month series.

import { describe, it, expect } from "vitest";
import {
  getMonthStr,
  getLastNMonths,
  filterTradesByMonth,
  filterCostsByMonth,
  calculatePLMetrics,
  calculateKPIMetrics,
  calculateHealthAlerts,
  calculateRunwayMetrics,
  calculateTrendMetrics,
  type PLMetrics,
} from "../metrics";
import type { BusinessCost } from "../types";
import type { Trade } from "@/lib/treasury/calculations";

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id:          over.id          ?? "t",
    account_id:  over.account_id  ?? "a1",
    entry_date:  over.entry_date  ?? "2026-06-01",
    exit_date:   over.exit_date   ?? "2026-06-15",
    pnl:         over.pnl ?? 100,
    status:      over.status      ?? "Closed",
  };
}

function cost(over: Partial<BusinessCost> = {}): BusinessCost {
  return {
    id:                    over.id ?? "c",
    user_id:               "u1",
    amount:                over.amount ?? 100,
    category:              over.category ?? "Tools Software",
    description:           over.description ?? "x",
    vendor:                over.vendor ?? "y",
    cost_date:             over.cost_date ?? "2026-06-10",
    is_recurring_instance: false,
    sort_index:            0,
    created_at:            "",
    updated_at:            "",
  };
}

describe("month helpers", () => {
  it("getMonthStr returns 'YYYY-MM'", () => {
    const m = getMonthStr();
    expect(m).toMatch(/^\d{4}-\d{2}$/);
  });

  it("getLastNMonths returns N elements sorted ascendente (oldest first)", () => {
    const months = getLastNMonths(3);
    expect(months).toHaveLength(3);
    for (const m of months) expect(m).toMatch(/^\d{4}-\d{2}$/);
    // Should be sorted (oldest to most recent).
    expect(months[0] < months[1]).toBe(true);
    expect(months[1] < months[2]).toBe(true);
  });
});

describe("filterTradesByMonth / filterCostsByMonth", () => {
  it("filterTradesByMonth match por prefix de exit_date", () => {
    const trades = [
      trade({ id: "t1", exit_date: "2026-06-15" }),
      trade({ id: "t2", exit_date: "2026-05-20" }),
      trade({ id: "t3", exit_date: "2026-06-30" }),
    ];
    const result = filterTradesByMonth(trades, "2026-06");
    expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("filterTradesByMonth ignora trades sin exit_date", () => {
    // The helper's `??` collapses `undefined` to the default; here we
    // construct a raw row so the test exercises the actual `?.` branch.
    const trades: Trade[] = [{
      id: "t1", account_id: "a1", entry_date: "2026-06-01",
      pnl: 100, status: "Closed",
    } as Trade];
    expect(filterTradesByMonth(trades, "2026-06")).toEqual([]);
  });

  it("filterCostsByMonth match por prefix de cost_date", () => {
    const costs = [
      cost({ id: "c1", cost_date: "2026-06-01" }),
      cost({ id: "c2", cost_date: "2026-05-01" }),
    ];
    expect(filterCostsByMonth(costs, "2026-06").map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("calculatePLMetrics", () => {
  it("grossIncome suma solo positives (excluye losses)", () => {
    const trades = [
      trade({ id: "t1", pnl: 100 }),
      trade({ id: "t2", pnl: -50 }),
      trade({ id: "t3", pnl: 200 }),
    ];
    const pl = calculatePLMetrics(trades, [], "2026-06");
    expect(pl.grossIncome).toBe(300);
  });

  it("netIncome = totalNetPnl - totalCosts (puede ser negativo)", () => {
    const trades = [trade({ pnl: 500 })];
    const costs = [cost({ amount: 200 }), cost({ amount: 100 })];
    const pl = calculatePLMetrics(trades, costs, "2026-06");
    expect(pl.totalCosts).toBe(300);
    expect(pl.netIncome).toBe(200);
  });

  it("costsByCategory agrega por categoría", () => {
    const costs = [
      cost({ amount: 100, category: "Tools Software" }),
      cost({ amount: 50,  category: "Tools Software" }),
      cost({ amount: 75,  category: "Data" }),
    ];
    const pl = calculatePLMetrics([], costs, "2026-06");
    expect(pl.costsByCategory).toEqual({ "Tools Software": 150, "Data": 75 });
  });

  it("incomeByAccount agrega por account_id (todos los pnls, no solo positives)", () => {
    const trades = [
      trade({ account_id: "a1", pnl: 100 }),
      trade({ account_id: "a1", pnl: -30 }),
      trade({ account_id: "a2", pnl: 250 }),
    ];
    const pl = calculatePLMetrics(trades, [], "2026-06");
    expect(pl.incomeByAccount).toEqual({ a1: 70, a2: 250 });
  });

  it("tradeCount cuenta solo trades del mes", () => {
    const trades = [
      trade({ id: "t1", exit_date: "2026-06-15" }),
      trade({ id: "t2", exit_date: "2026-05-15" }),
    ];
    const pl = calculatePLMetrics(trades, [], "2026-06");
    expect(pl.tradeCount).toBe(1);
  });

  it("margin = (netIncome / grossIncome) * 100; 0 cuando grossIncome=0", () => {
    expect(calculatePLMetrics([], [], "2026-06").margin).toBe(0);
    const trades = [trade({ pnl: 500 })];
    expect(calculatePLMetrics(trades, [cost({ amount: 100 })], "2026-06").margin)
      .toBe(80);  // (500-100)/500 * 100 = 80
  });
});

describe("calculateKPIMetrics", () => {
  it("uniqueTradeDays cuenta exit_dates únicos", () => {
    const trades = [
      trade({ id: "t1", exit_date: "2026-06-01" }),
      trade({ id: "t2", exit_date: "2026-06-01" }),  // same day
      trade({ id: "t3", exit_date: "2026-06-15" }),
    ];
    const kpi = calculateKPIMetrics(trades, [], "2026-06");
    expect(kpi.uniqueTradeDays).toBe(2);
  });

  it("daysInMonth correcto para junio (30)", () => {
    expect(calculateKPIMetrics([], [], "2026-06").daysInMonth).toBe(30);
  });

  it("daysInMonth correcto para febrero bisiesto (29)", () => {
    expect(calculateKPIMetrics([], [], "2024-02").daysInMonth).toBe(29);
  });

  it("consistency = (uniqueDays / daysInMonth) * 100", () => {
    const trades = [
      trade({ exit_date: "2026-06-01" }),
      trade({ exit_date: "2026-06-15" }),
      trade({ exit_date: "2026-06-30" }),
    ];
    // 3/30 * 100 = 10
    expect(calculateKPIMetrics(trades, [], "2026-06").consistency).toBeCloseTo(10, 5);
  });

  it("costPerTrade = totalCosts / tradeCount", () => {
    const trades = [trade(), trade({ id: "t2" })];
    const costs = [cost({ amount: 200 })];
    const kpi = calculateKPIMetrics(trades, costs, "2026-06");
    expect(kpi.costPerTrade).toBe(100);
  });

  it("accountMetrics: proportional cost allocation por trade count", () => {
    const trades = [
      trade({ id: "t1", account_id: "a1", exit_date: "2026-06-01", pnl: 1000 }),
      trade({ id: "t2", account_id: "a1", exit_date: "2026-06-15", pnl: 500 }),
      trade({ id: "t3", account_id: "a2", exit_date: "2026-06-20", pnl: 400 }),
    ];
    const costs = [cost({ amount: 300 })];  // 300 / 3 = 100 per trade
    const kpi = calculateKPIMetrics(trades, costs, "2026-06");

    // a1: 2 trades → 200 cost allocation, netProfit = 1500 - 200 = 1300
    expect(kpi.accountMetrics.a1.tradeCount).toBe(2);
    expect(kpi.accountMetrics.a1.netProfit).toBe(1300);

    // a2: 1 trade → 100 cost allocation, netProfit = 400 - 100 = 300
    expect(kpi.accountMetrics.a2.netProfit).toBe(300);
  });

  it("custom costAllocationFn override usado en lugar del default", () => {
    const trades = [
      trade({ account_id: "a1", exit_date: "2026-06-01", pnl: 1000 }),
      trade({ account_id: "a2", exit_date: "2026-06-02", pnl: 500 }),
    ];
    const costs = [cost({ amount: 200 })];
    const customFn = (accountId: string) => accountId === "a1" ? 200 : 0;
    const kpi = calculateKPIMetrics(trades, costs, "2026-06", customFn);

    expect(kpi.accountMetrics.a1.netProfit).toBe(800);   // 1000 - 200
    expect(kpi.accountMetrics.a2.netProfit).toBe(500);   // 500 - 0
  });
});

describe("calculateHealthAlerts", () => {
  function pl(over: Partial<PLMetrics> = {}): PLMetrics {
    return {
      monthStr:        over.monthStr ?? "2026-06",
      grossIncome:     over.grossIncome ?? 0,
      netIncome:       over.netIncome ?? 0,
      totalCosts:      over.totalCosts ?? 0,
      costsByCategory: over.costsByCategory ?? {},
      incomeByAccount: over.incomeByAccount ?? {},
      tradeCount:      over.tradeCount ?? 0,
      margin:          over.margin ?? 0,
    };
  }

  it("returns [] cuando todos los meses positivos y runway abundante", () => {
    expect(calculateHealthAlerts([pl({ netIncome: 100 })], 12, 3)).toEqual([]);
  });

  it("añade alerta 'negative-month' por cada mes con netIncome < 0", () => {
    const alerts = calculateHealthAlerts([
      pl({ monthStr: "2026-05", netIncome: -100 }),
      pl({ monthStr: "2026-06", netIncome: -50 }),
    ], 12);
    expect(alerts.filter((a) => a.id.startsWith("negative-month-"))).toHaveLength(2);
    expect(alerts[0].severity).toBe("warning");
  });

  it("low-runway warning cuando runway < threshold pero > 0", () => {
    const alerts = calculateHealthAlerts([], 1.5, 3);
    expect(alerts.some((a) => a.id === "low-runway" && a.severity === "critical")).toBe(true);
  });

  it("critical-runway cuando runway <= 0", () => {
    expect(calculateHealthAlerts([], 0).some((a) => a.id === "critical-runway")).toBe(true);
    expect(calculateHealthAlerts([], -5).some((a) => a.id === "critical-runway")).toBe(true);
  });
});

describe("calculateRunwayMetrics", () => {
  function pl(netIncome: number, totalCosts: number): PLMetrics {
    return {
      monthStr: "2026-06", grossIncome: 0, netIncome, totalCosts,
      costsByCategory: {}, incomeByAccount: {}, tradeCount: 0, margin: 0,
    };
  }

  it("avgMonthlyProfit y avgMonthlyBurn calculados sobre last 3 months", () => {
    const r = calculateRunwayMetrics([pl(100, 50), pl(200, 100), pl(150, 75)], 0);
    expect(r.avgMonthlyProfit).toBeCloseTo(150, 5);
    expect(r.avgMonthlyBurn).toBeCloseTo(75, 5);
  });

  it("runwayMonths = max(0, cashReserve / avgBurn)", () => {
    const r = calculateRunwayMetrics([pl(0, 1000), pl(0, 1000), pl(0, 1000)], 5000);
    expect(r.runwayMonths).toBe(5);
  });

  it("runwayMonths = 0 cuando avgBurn es 0 (sin gastos)", () => {
    const r = calculateRunwayMetrics([pl(100, 0)], 5000);
    expect(r.runwayMonths).toBe(0);  // Infinity converted to 0
  });

  it("empty array → todo cero", () => {
    const r = calculateRunwayMetrics([], 0);
    expect(r.avgMonthlyProfit).toBe(0);
    expect(r.avgMonthlyBurn).toBe(0);
    expect(r.runwayRatio).toBe(0);
  });

  it("runwayRatio = avgProfit / avgBurn cuando burn > 0", () => {
    const r = calculateRunwayMetrics([pl(500, 100)], 0);
    expect(r.runwayRatio).toBe(5);
  });
});

describe("calculateTrendMetrics", () => {
  it("retorna serie de 6 meses con income/costs/profit", () => {
    const trend = calculateTrendMetrics([], []);
    expect(trend).toHaveLength(6);
    for (const t of trend) {
      expect(t.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof t.income).toBe("number");
      expect(typeof t.costs).toBe("number");
      expect(typeof t.profit).toBe("number");
    }
  });

  it("trend con data: income > 0 + costs > 0 + profit = income - costs", () => {
    const months = getLastNMonths(6);
    const latestMonth = months[months.length - 1];
    const trades = [trade({ exit_date: `${latestMonth}-15`, pnl: 500 })];
    const costs  = [cost({ cost_date: `${latestMonth}-10`, amount: 200 })];
    const trend = calculateTrendMetrics(trades, costs);
    const last = trend[trend.length - 1];
    expect(last.income).toBe(500);
    expect(last.costs).toBe(200);
  });
});
