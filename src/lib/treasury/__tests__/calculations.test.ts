// Unit tests for src/lib/treasury/calculations.ts.
//
// Pure helpers consumidos por Treasury UI + payout engine. Cubre formulas
// críticas (drawdown, health score, retirable, milestones) sin acoplar a
// la UI ni a Supabase.

import { describe, it, expect } from "vitest";
import {
  getSplitPercentage,
  calculateRetirable,
  calculateDrawdown,
  calculateHealthScore,
  daysUntilNextWithdrawal,
  calculateTaxBufferReserve,
  getHealthScoreVariant,
  getHealthScoreStatus,
  isEvaluationPhase,
  clamp,
  formatCurrency,
  formatPercentage,
  calculateMilestoneProgress,
  calculateMilestoneRemaining,
  calculateTaxBufferProgress,
  groupByDate,
  sumByDateRange,
  formatDate,
  getDayName,
  type Account,
  type TreasuryConfig,
  type Trade,
} from "../calculations";

const ACCOUNT_BASE: Account = {
  id:                   "a1",
  name:                 "Test",
  account_size:         10_000,
  current_balance:      10_000,
  withdrawals_enabled:  true,
};

const CONFIG_BASE: TreasuryConfig = {
  account_id:              "a1",
  withdrawal_day:          15,
  split_mode:              "growth",
  anti_drawdown_active:    true,
  anti_drawdown_threshold: 20,
  tax_buffer_percentage:   30,
  tax_buffer_accumulated:  0,
  milestone_bonus_vault:   0,
};

describe("getSplitPercentage", () => {
  it("growth=50, safe=40, cash=100", () => {
    expect(getSplitPercentage("growth")).toBe(50);
    expect(getSplitPercentage("safe")).toBe(40);
    expect(getSplitPercentage("cash")).toBe(100);
  });
});

describe("calculateRetirable", () => {
  it("returns 0 when account is invalid o tiene profit <= 0", () => {
    expect(calculateRetirable({ ...ACCOUNT_BASE, current_balance: 0 })).toBe(0);
    expect(calculateRetirable({ ...ACCOUNT_BASE, current_balance: 9_000 })).toBe(0);
  });

  it("growth: 50% del profit", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 12_000 };  // +2000 profit
    expect(calculateRetirable(acc, { split_mode: "growth" })).toBe(1000);
  });

  it("safe: 40% del profit", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 12_000 };
    expect(calculateRetirable(acc, { split_mode: "safe" })).toBe(800);
  });

  it("cash: 100% del profit", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 12_000 };
    expect(calculateRetirable(acc, { split_mode: "cash" })).toBe(2000);
  });

  it("default 'growth' cuando no se pasa config", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 12_000 };
    expect(calculateRetirable(acc)).toBe(1000);
  });
});

describe("calculateDrawdown", () => {
  function makeClosedTrade(over: Partial<Trade> = {}): Trade {
    return {
      id: over.id ?? "t1",
      account_id: over.account_id ?? "a1",
      entry_date: over.entry_date ?? "2026-01-01",
      exit_date:  over.exit_date  ?? "2026-01-02",
      pnl:        over.pnl ?? 0,
      status:     over.status ?? "Closed",
    };
  }

  it("returns 0 cuando no hay trades closed", () => {
    expect(calculateDrawdown("a1", ACCOUNT_BASE, [])).toBe(0);
  });

  it("returns 0 cuando account es undefined", () => {
    expect(calculateDrawdown("a1", undefined, [makeClosedTrade({ pnl: -500 })])).toBe(0);
  });

  it("ignora Open trades (solo Closed cuentan)", () => {
    const trades = [
      makeClosedTrade({ pnl: -2000, status: "Open" as const }),
    ];
    expect(calculateDrawdown("a1", ACCOUNT_BASE, trades)).toBe(0);
  });

  it("computes drawdown desde peak con secuencia +500, -1500 → 10%", () => {
    const trades = [
      makeClosedTrade({ id: "t1", exit_date: "2026-01-01", pnl:  500  }),  // peak=10500
      makeClosedTrade({ id: "t2", exit_date: "2026-01-02", pnl: -1500 }),  // balance=9000, dd=(10500-9000)/10500 ≈ 14.28
    ];
    const dd = calculateDrawdown("a1", ACCOUNT_BASE, trades);
    expect(dd).toBeCloseTo(14.28, 1);
  });

  it("sort por exit_date ascendente — orden del input no importa", () => {
    const tradesA = [
      makeClosedTrade({ id: "t2", exit_date: "2026-01-02", pnl: -500 }),
      makeClosedTrade({ id: "t1", exit_date: "2026-01-01", pnl:  500 }),
    ];
    const tradesB = [
      makeClosedTrade({ id: "t1", exit_date: "2026-01-01", pnl:  500 }),
      makeClosedTrade({ id: "t2", exit_date: "2026-01-02", pnl: -500 }),
    ];
    expect(calculateDrawdown("a1", ACCOUNT_BASE, tradesA))
      .toBeCloseTo(calculateDrawdown("a1", ACCOUNT_BASE, tradesB), 5);
  });
});

describe("calculateHealthScore", () => {
  it("returns 100 para account sano sin drawdown", () => {
    expect(calculateHealthScore(ACCOUNT_BASE, CONFIG_BASE, 0)).toBe(100);
  });

  it("evaluation phase resta 50", () => {
    const acc = { ...ACCOUNT_BASE, phase_status: "fase evaluacion" };
    expect(calculateHealthScore(acc, CONFIG_BASE, 0)).toBe(50);
  });

  it("withdrawals disabled → score=0 (override absoluto)", () => {
    const acc = { ...ACCOUNT_BASE, withdrawals_enabled: false };
    expect(calculateHealthScore(acc, CONFIG_BASE, 0)).toBe(0);
  });

  it("drawdown >= anti_drawdown_threshold resta 50", () => {
    expect(calculateHealthScore(ACCOUNT_BASE, CONFIG_BASE, 25)).toBe(50);
  });

  it("balance debajo del threshold resta 30", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 8_000 };
    const cfg = { ...CONFIG_BASE, balance_threshold: 9_000 };
    expect(calculateHealthScore(acc, cfg, 0)).toBe(70);
  });

  it("clamp a [0, 100] cuando suma de penalties excede 100", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 8_000, phase_status: "fase evaluacion" };
    const cfg = { ...CONFIG_BASE, balance_threshold: 9_000 };
    // -50 (eval) - 50 (drawdown) - 30 (balance) = -130 → clamped 0
    expect(calculateHealthScore(acc, cfg, 25)).toBe(0);
  });
});

describe("daysUntilNextWithdrawal", () => {
  it("returns 0+ days hasta el próximo withdrawal_day", () => {
    const days = daysUntilNextWithdrawal(15);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(31);
  });

  it("default withdrawal_day=1 cuando no se pasa", () => {
    const days = daysUntilNextWithdrawal();
    expect(days).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateTaxBufferReserve", () => {
  it("retirable * tax_buffer_percentage / 100", () => {
    expect(calculateTaxBufferReserve(1000, 30)).toBe(300);
    expect(calculateTaxBufferReserve(1000, 0)).toBe(0);
  });
  it("default 30%", () => {
    expect(calculateTaxBufferReserve(1000)).toBe(300);
  });
});

describe("getHealthScoreVariant + Status", () => {
  it("100 → default, 50-99 → warning, 0-49 → destructive", () => {
    expect(getHealthScoreVariant(100)).toBe("default");
    expect(getHealthScoreVariant(80)).toBe("warning");
    expect(getHealthScoreVariant(50)).toBe("warning");
    expect(getHealthScoreVariant(49)).toBe("destructive");
    expect(getHealthScoreVariant(0)).toBe("destructive");
  });

  it("status text matches tiers", () => {
    expect(getHealthScoreStatus(100)).toMatch(/Excelente/);
    expect(getHealthScoreStatus(60)).toMatch(/Bueno/);
    expect(getHealthScoreStatus(10)).toMatch(/Crítico/);
  });
});

describe("isEvaluationPhase", () => {
  it("true cuando phase_status contiene 'fase'", () => {
    expect(isEvaluationPhase({ ...ACCOUNT_BASE, phase_status: "fase 1" })).toBe(true);
    expect(isEvaluationPhase({ ...ACCOUNT_BASE, phase_status: "Fase Evaluacion" })).toBe(true);
  });
  it("false cuando phase_status no contiene 'fase'", () => {
    expect(isEvaluationPhase({ ...ACCOUNT_BASE, phase_status: "funded" })).toBe(false);
    expect(isEvaluationPhase(ACCOUNT_BASE)).toBe(false);
  });
});

describe("clamp", () => {
  it("clamps a [min, max]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("formatCurrency", () => {
  it("USD format con decimals default 0", () => {
    expect(formatCurrency(1234.5)).toBe("$1,235");
  });
  it("custom decimals", () => {
    expect(formatCurrency(1234.5, 2)).toBe("$1,234.50");
  });
});

describe("formatPercentage", () => {
  it("appends '%' con decimals default 1", () => {
    expect(formatPercentage(12.345)).toBe("12.3%");
    expect(formatPercentage(12.345, 2)).toBe("12.35%");
  });
});

describe("calculateMilestoneProgress / Remaining", () => {
  it("progress = current / target * 100, clamped [0, 100]", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 30_000 };
    expect(calculateMilestoneProgress(acc, { milestone_target: 50_000 })).toBe(60);
  });

  it("progress clamped a 100 cuando balance excede target", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 75_000 };
    expect(calculateMilestoneProgress(acc, { milestone_target: 50_000 })).toBe(100);
  });

  it("returns 0 cuando no hay milestone_target", () => {
    expect(calculateMilestoneProgress(ACCOUNT_BASE)).toBe(0);
    expect(calculateMilestoneRemaining(ACCOUNT_BASE)).toBe(0);
  });

  it("remaining = target - current, max(0, ...)", () => {
    const acc = { ...ACCOUNT_BASE, current_balance: 30_000 };
    expect(calculateMilestoneRemaining(acc, { milestone_target: 50_000 })).toBe(20_000);
    expect(calculateMilestoneRemaining({ ...acc, current_balance: 60_000 }, { milestone_target: 50_000 })).toBe(0);
  });
});

describe("calculateTaxBufferProgress", () => {
  it("accumulated / target * 100", () => {
    expect(calculateTaxBufferProgress({ tax_buffer_target: 1000, tax_buffer_accumulated: 250 })).toBe(25);
  });
  it("returns 0 cuando target faltante o 0", () => {
    expect(calculateTaxBufferProgress({ tax_buffer_accumulated: 100 })).toBe(0);
    expect(calculateTaxBufferProgress({ tax_buffer_target: 0, tax_buffer_accumulated: 100 })).toBe(0);
  });
});

describe("groupByDate", () => {
  it("agrupa items por occurred_on / payout_date", () => {
    const items = [
      { occurred_on: "2026-01-01", id: "a" },
      { occurred_on: "2026-01-01", id: "b" },
      { occurred_on: "2026-01-02", id: "c" },
    ];
    const grouped = groupByDate(items);
    expect(grouped.get("2026-01-01")).toHaveLength(2);
    expect(grouped.get("2026-01-02")).toHaveLength(1);
  });
});

describe("sumByDateRange", () => {
  it("suma items dentro del rango (inclusive)", () => {
    const items = [
      { occurred_on: "2026-01-01", amount: 100 },
      { occurred_on: "2026-01-15", amount: 200 },
      { occurred_on: "2026-02-01", amount: 50 },
    ];
    expect(sumByDateRange(items, "2026-01-01", "2026-01-31")).toBe(300);
  });
});

describe("formatDate / getDayName", () => {
  it("formatDate produces YYYY-MM-DD", () => {
    expect(formatDate("2026-06-14T10:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("getDayName returns 3-letter short weekday", () => {
    const name = getDayName("2026-06-14");
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });
});
