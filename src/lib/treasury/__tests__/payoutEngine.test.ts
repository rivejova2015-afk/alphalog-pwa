// Unit tests for src/lib/treasury/payoutEngine.ts.
//
// Pure helpers para cycle computation + payout breakdown. Cubre:
//   - computeCycleStart: lógica del withdrawal_day vs today.
//   - computeCycleExpectedEnd: next cycle start - 1 día.
//   - calculatePeriodPnL: filtra trades por rango [cycleStart, calcCutoff].
//   - calculateRetirableFromPeriod: aplica split + clamp.
//   - calculatePayoutBreakdown: composición de bloqueos + allocations.
//   - isPayoutCreatable: not blocked AND retirable > 0.
//   - shouldSendThresholdPush: balance >= threshold AND retirable > 0.

import { describe, it, expect } from "vitest";
import {
  computeCycleStart,
  computeCycleExpectedEnd,
  getCycleInfo,
  calculatePeriodPnL,
  calculateRetirableFromPeriod,
  calculatePayoutBreakdown,
  isPayoutCreatable,
  shouldSendThresholdPush,
  formatCycleDates,
  getNextVersion,
} from "../payoutEngine";
import type { Account, TreasuryConfig, Trade } from "../calculations";

const ACCOUNT: Account = {
  id: "a1", name: "Test", account_size: 10_000,
  current_balance: 12_000, withdrawals_enabled: true,
};

const CONFIG: TreasuryConfig = {
  account_id:              "a1",
  withdrawal_day:          15,
  split_mode:              "growth",
  anti_drawdown_active:    true,
  anti_drawdown_threshold: 20,
  tax_buffer_percentage:   30,
  tax_buffer_accumulated:  0,
  milestone_bonus_vault:   0,
};

describe("computeCycleStart", () => {
  it("today.date >= withdrawal_day → cycle_start es este mes", () => {
    const today = new Date(Date.UTC(2026, 0, 20));  // Jan 20
    const start = computeCycleStart(15, today);
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(0);
    expect(start.getUTCDate()).toBe(15);
  });

  it("today.date < withdrawal_day → cycle_start es mes anterior", () => {
    const today = new Date(Date.UTC(2026, 0, 10));  // Jan 10
    const start = computeCycleStart(15, today);
    expect(start.getUTCFullYear()).toBe(2025);
    expect(start.getUTCMonth()).toBe(11);  // December
    expect(start.getUTCDate()).toBe(15);
  });

  it("withdrawal_day=30 + today=Feb 5 → cycle_start=Jan 28 (capped)", () => {
    const today = new Date(Date.UTC(2026, 1, 5));  // Feb 5
    const start = computeCycleStart(30, today);
    // withdrawal_day=30 is capped at 28 (lib clamps to 28 for month-end safety).
    expect(start.getUTCMonth()).toBe(0);  // Jan
    expect(start.getUTCDate()).toBe(28);
  });

  it("year boundary: today=Jan 5, wd=15 → cycle_start = Dec 15 año previo", () => {
    const today = new Date(Date.UTC(2026, 0, 5));
    const start = computeCycleStart(15, today);
    expect(start.getUTCFullYear()).toBe(2025);
    expect(start.getUTCMonth()).toBe(11);
  });

  it("withdrawal_day=1 (primero de mes) → today=Mar 15 → cycle_start=Mar 1", () => {
    const today = new Date(Date.UTC(2026, 2, 15));
    const start = computeCycleStart(1, today);
    expect(start.getUTCMonth()).toBe(2);
    expect(start.getUTCDate()).toBe(1);
  });
});

describe("computeCycleExpectedEnd", () => {
  it("end es el día previo al next cycle start", () => {
    const cycleStart = new Date(Date.UTC(2026, 0, 15));  // Jan 15
    const end = computeCycleExpectedEnd(15, cycleStart);
    // Next cycle = Feb 15 → end = Feb 14
    expect(end.getUTCMonth()).toBe(1);  // Feb
    expect(end.getUTCDate()).toBe(14);
  });
});

describe("getCycleInfo", () => {
  it("retorna cycleStart + cycleExpectedEnd + calcCutoff", () => {
    const today = new Date(Date.UTC(2026, 0, 20));
    const info = getCycleInfo(15, today);
    expect(info.cycleStart).toEqual(new Date(Date.UTC(2026, 0, 15)));
    expect(info.cycleExpectedEnd).toEqual(new Date(Date.UTC(2026, 1, 14)));
    expect(info.calcCutoff).toEqual(today);
  });
});

describe("calculatePeriodPnL", () => {
  const cycleStart = new Date(Date.UTC(2026, 0, 15));
  const calcCutoff = new Date(Date.UTC(2026, 1, 14));

  function trade(over: Partial<Trade> = {}): Trade {
    return {
      id: over.id ?? "t",
      account_id: over.account_id ?? "a1",
      entry_date: over.entry_date ?? "2026-01-20",
      exit_date:  over.exit_date,
      pnl:        over.pnl ?? 100,
      status:     over.status ?? "Closed",
    };
  }

  it("returns 0 cuando no hay trades para la account", () => {
    expect(calculatePeriodPnL("a1", [], cycleStart, calcCutoff)).toBe(0);
  });

  it("ignora trades de OTRO account", () => {
    const trades = [trade({ account_id: "a2", exit_date: "2026-01-20", pnl: 500 })];
    expect(calculatePeriodPnL("a1", trades, cycleStart, calcCutoff)).toBe(0);
  });

  it("ignora Open trades", () => {
    const trades = [trade({ exit_date: "2026-01-20", pnl: 500, status: "Open" as const })];
    expect(calculatePeriodPnL("a1", trades, cycleStart, calcCutoff)).toBe(0);
  });

  it("incluye trades con exit_date dentro del rango (inclusive)", () => {
    const trades = [
      trade({ id: "t1", exit_date: "2026-01-15", pnl: 100 }),  // boundary inclusive
      trade({ id: "t2", exit_date: "2026-01-20", pnl: 200 }),
      trade({ id: "t3", exit_date: "2026-02-14", pnl: 300 }),  // boundary inclusive
    ];
    expect(calculatePeriodPnL("a1", trades, cycleStart, calcCutoff)).toBe(600);
  });

  it("excluye trades fuera del rango", () => {
    const trades = [
      trade({ id: "t1", exit_date: "2026-01-14", pnl: 999 }),  // before
      trade({ id: "t2", exit_date: "2026-02-15", pnl: 999 }),  // after
      trade({ id: "t3", exit_date: "2026-01-20", pnl: 100 }),
    ];
    expect(calculatePeriodPnL("a1", trades, cycleStart, calcCutoff)).toBe(100);
  });

  it("fallback a entry_date cuando exit_date es undefined", () => {
    const trades = [trade({ id: "t1", entry_date: "2026-01-20", exit_date: undefined, pnl: 100 })];
    expect(calculatePeriodPnL("a1", trades, cycleStart, calcCutoff)).toBe(100);
  });
});

describe("calculateRetirableFromPeriod", () => {
  it("retirable = min(periodPnL, profitTotal) * split%", () => {
    // periodPnL=1000, profitTotal=500 → payoutable=500 → growth 50% = 250
    expect(calculateRetirableFromPeriod(1000, 500, "growth")).toBe(250);
    expect(calculateRetirableFromPeriod(1000, 500, "safe")).toBe(200);
    expect(calculateRetirableFromPeriod(1000, 500, "cash")).toBe(500);
  });

  it("returns 0 cuando periodPnL es negativo", () => {
    expect(calculateRetirableFromPeriod(-500, 2000, "growth")).toBe(0);
  });

  it("returns 0 cuando profitTotal es negativo (sin profit acumulado)", () => {
    expect(calculateRetirableFromPeriod(1000, -500, "growth")).toBe(0);
  });

  it("returns 0 cuando profitTotal es exactamente 0", () => {
    expect(calculateRetirableFromPeriod(500, 0, "growth")).toBe(0);
  });

  it("default 'growth' cuando no se pasa split mode", () => {
    expect(calculateRetirableFromPeriod(1000, 2000, undefined)).toBe(500);
  });
});

describe("calculatePayoutBreakdown — blocking conditions", () => {
  it("withdrawals disabled → blockedReasons incluye 'withdrawals_disabled'", () => {
    const acc = { ...ACCOUNT, withdrawals_enabled: false };
    const br = calculatePayoutBreakdown(acc, CONFIG, 1000, 0);
    expect(br.blockedReasons).toContain("withdrawals_disabled");
  });

  it("anti_dd activo + drawdown >= threshold → blockedReasons incluye 'anti_dd_active'", () => {
    const cfg = { ...CONFIG, anti_drawdown_active: true, anti_drawdown_threshold: 20 };
    const br = calculatePayoutBreakdown(ACCOUNT, cfg, 1000, 25);
    expect(br.blockedReasons).toContain("anti_dd_active");
  });

  it("balance < balance_threshold → 'balance_below_threshold'", () => {
    const acc = { ...ACCOUNT, current_balance: 8_000 };
    const cfg = { ...CONFIG, balance_threshold: 9_000 };
    const br = calculatePayoutBreakdown(acc, cfg, 1000, 0);
    expect(br.blockedReasons).toContain("balance_below_threshold");
  });

  it("multiple blockers se acumulan", () => {
    const acc = { ...ACCOUNT, withdrawals_enabled: false, current_balance: 8_000 };
    const cfg = { ...CONFIG, balance_threshold: 9_000 };
    const br = calculatePayoutBreakdown(acc, cfg, 1000, 25);
    expect(br.blockedReasons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("calculatePayoutBreakdown — allocations", () => {
  it("retirable + taxReserve (30%) + cash_payout (resto)", () => {
    // profitTotal = 12_000 - 10_000 = 2_000
    // payoutable = min(1000, 2000) = 1000 → retirable (growth 50%) = 500
    // tax = 500 * 0.30 = 150
    // cash = 500 - 150 - 0 = 350
    const br = calculatePayoutBreakdown(ACCOUNT, CONFIG, 1000, 0);
    expect(br.retirable).toBe(500);
    expect(br.taxReserveAmount).toBe(150);
    expect(br.bonusVaultAmount).toBe(0);
    expect(br.cashPayoutAmount).toBe(350);
  });

  it("tax_buffer_percentage=0 → todo retirable es cash", () => {
    const cfg = { ...CONFIG, tax_buffer_percentage: 0 };
    const br = calculatePayoutBreakdown(ACCOUNT, cfg, 1000, 0);
    expect(br.taxReserveAmount).toBe(0);
    expect(br.cashPayoutAmount).toBe(br.retirable);
  });

  it("split_mode 'cash' → retirable = full payoutable profit", () => {
    const cfg = { ...CONFIG, split_mode: "cash" as const };
    const br = calculatePayoutBreakdown(ACCOUNT, cfg, 1000, 0);
    expect(br.retirable).toBe(1000);  // 100% del payoutable
  });
});

describe("isPayoutCreatable", () => {
  it("true cuando blockedReasons=[] y retirable > 0", () => {
    expect(isPayoutCreatable({ retirable: 500, taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 0, blockedReasons: [] })).toBe(true);
  });

  it("false cuando hay blockedReasons", () => {
    expect(isPayoutCreatable({ retirable: 500, taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 0, blockedReasons: ["anti_dd_active"] })).toBe(false);
  });

  it("false cuando retirable=0 incluso sin bloqueos", () => {
    expect(isPayoutCreatable({ retirable: 0, taxReserveAmount: 0, bonusVaultAmount: 0, cashPayoutAmount: 0, blockedReasons: [] })).toBe(false);
  });
});

describe("shouldSendThresholdPush", () => {
  it("false cuando no hay balance_threshold configurado", () => {
    const cfg = { ...CONFIG, balance_threshold: undefined };
    expect(shouldSendThresholdPush(ACCOUNT, cfg, 500)).toBe(false);
  });

  it("true cuando balance >= threshold AND retirable > 0", () => {
    const cfg = { ...CONFIG, balance_threshold: 11_000 };
    expect(shouldSendThresholdPush(ACCOUNT, cfg, 500)).toBe(true);
  });

  it("false cuando balance >= threshold pero retirable=0", () => {
    const cfg = { ...CONFIG, balance_threshold: 11_000 };
    expect(shouldSendThresholdPush(ACCOUNT, cfg, 0)).toBe(false);
  });

  it("false cuando balance < threshold", () => {
    const acc = { ...ACCOUNT, current_balance: 9_000 };
    const cfg = { ...CONFIG, balance_threshold: 11_000 };
    expect(shouldSendThresholdPush(acc, cfg, 500)).toBe(false);
  });
});

describe("formatCycleDates", () => {
  it("returns 'Jan 15 - Feb 14' shape", () => {
    const start = new Date(Date.UTC(2026, 0, 15));
    const end   = new Date(Date.UTC(2026, 1, 14));
    const out = formatCycleDates(start, end);
    expect(out).toMatch(/^\w+ \d+ - \w+ \d+$/);
  });
});

describe("getNextVersion", () => {
  it("default 1 cuando no hay versiones previas", () => {
    expect(getNextVersion(0)).toBe(1);
    expect(getNextVersion()).toBe(1);
  });
  it("returns maxVersion + 1", () => {
    expect(getNextVersion(3)).toBe(4);
  });
});
