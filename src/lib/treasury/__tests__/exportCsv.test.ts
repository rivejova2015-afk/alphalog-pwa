// Unit tests for src/lib/treasury/exportCsv.ts.
//
// Pure helpers para generar CSVs de treasury. Validates:
//   - generateTreasuryExportCsv: SUMMARY + PAYOUTS + TRANSACTIONS sections.
//   - calculateExportSummary: agrega closed trades + payouts por status.
//   - getMonthDateRange: parse YYYY-MM → first/last day UTC.
//   - Edge cases: empty arrays, malformed input, special chars que requieren
//     CSV quoting.

import { describe, it, expect } from "vitest";
import {
  generateTreasuryExportCsv,
  calculateExportSummary,
  getMonthDateRange,
} from "../exportCsv";

describe("generateTreasuryExportCsv", () => {
  const baseSummary = {
    total_closed_pnl:        1250.5,
    total_payouts_planned:   500,
    total_payouts_sent:      300,
    total_payouts_received:  200,
    total_tax_reserve_added: 150,
    total_bonus_vault_added: 0,
    export_month:            "2026-06",
    export_date:             "2026-06-14",
  };

  it("CSV incluye sección SUMMARY con header + metrics", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [],
      transactions: [],
    });
    expect(csv).toContain("SUMMARY");
    expect(csv).toContain("Metric,Value");
    expect(csv).toContain("Export Month,2026-06");
    expect(csv).toContain("Total Closed PnL,1250.50");
  });

  it("CSV con payouts vacíos muestra '(No payouts in this period)'", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [],
      transactions: [],
    });
    expect(csv).toContain("PAYOUTS");
    expect(csv).toContain("(No payouts in this period)");
  });

  it("CSV con payouts incluye header + filas formateadas", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [{
        id: "p1",
        account_name: "Main account",
        account_id: "a1",
        cycle_start: "2026-06-01",
        cycle_expected_end: "2026-06-30",
        payout_date: "2026-06-15",
        status: "sent",
        cash_payout_amount: 250.75,
        tax_reserve_amount: 100,
        bonus_vault_amount: 0,
        pnl_snapshot: 350.75,
        created_at: "2026-06-10T10:00:00Z",
        amount: 350.75,
      }],
      transactions: [],
    });
    expect(csv).toContain("Account,Cycle Start,Cycle End,Payout Date,Status");
    expect(csv).toContain("Main account");
    expect(csv).toContain("sent");
    expect(csv).toContain("250.75");
  });

  it("escapeCsvField: campos con coma se quotean", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [{
        id: "p1",
        account_name: "Main, with comma",
        account_id: "a1",
        status: "sent",
        amount: 100,
      }],
      transactions: [],
    });
    expect(csv).toContain('"Main, with comma"');
  });

  it("escapeCsvField: campos con quotes internas se doblan", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [],
      // Transaction row maps `description` → 'Description' column.
      transactions: [{
        id: "t1",
        amount: 100,
        type: "transfer",
        date: "2026-06-14",
        description: 'transfer "out"',
      }],
    });
    expect(csv).toContain('""out""');
  });

  it("currency fields formateados a 2 decimales (incluso strings numéricos)", () => {
    const csv = generateTreasuryExportCsv({
      summary: baseSummary,
      payouts: [{
        id: "p1",
        account_name: "x",
        account_id: "a1",
        status: "sent",
        cash_payout_amount: "250.123" as unknown as number,  // string en DB
        tax_reserve_amount: 100,
        bonus_vault_amount: 0,
        pnl_snapshot: 350,
        amount: 350,
      }],
      transactions: [],
    });
    expect(csv).toContain("250.12");
  });
});

describe("calculateExportSummary", () => {
  const fromDate = new Date("2026-06-01T00:00:00Z");
  const toDate   = new Date("2026-06-30T23:59:59Z");

  it("filtra Closed trades dentro del rango y suma pnl", () => {
    const trades = [
      { status: "Closed", closed_at: "2026-06-15T10:00:00Z", pnl: 100 },
      { status: "Closed", closed_at: "2026-06-20T10:00:00Z", pnl: 250 },
      { status: "Closed", closed_at: "2026-05-30T10:00:00Z", pnl: 999 },  // out of range
      { status: "Open",   closed_at: "2026-06-10T10:00:00Z", pnl: 500 },  // not closed
    ];
    const summary = calculateExportSummary(trades, [], fromDate, toDate, "2026-06");
    expect(summary.total_closed_pnl).toBe(350);
  });

  it("agrega payouts por status (planned/sent/received)", () => {
    const payouts = [
      { payout_date: "2026-06-05", status: "planned",  amount: 100 },
      { payout_date: "2026-06-10", status: "planned",  amount: 50 },
      { payout_date: "2026-06-12", status: "sent",     amount: 200 },
      { payout_date: "2026-06-20", status: "received", amount: 75 },
    ];
    const summary = calculateExportSummary([], payouts, fromDate, toDate, "2026-06");
    expect(summary.total_payouts_planned).toBe(150);
    expect(summary.total_payouts_sent).toBe(200);
    expect(summary.total_payouts_received).toBe(75);
  });

  it("suma tax_reserve + bonus_vault de TODOS los payouts en rango", () => {
    const payouts = [
      { payout_date: "2026-06-15", status: "sent", amount: 100, tax_reserve_amount: 30, bonus_vault_amount: 0 },
      { payout_date: "2026-06-20", status: "planned", amount: 50, tax_reserve_amount: 15, bonus_vault_amount: 5 },
    ];
    const summary = calculateExportSummary([], payouts, fromDate, toDate, "2026-06");
    expect(summary.total_tax_reserve_added).toBe(45);
    expect(summary.total_bonus_vault_added).toBe(5);
  });

  it("export_month y export_date en la summary", () => {
    const summary = calculateExportSummary([], [], fromDate, toDate, "2026-06");
    expect(summary.export_month).toBe("2026-06");
    expect(summary.export_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("counts 0 cuando los arrays están vacíos", () => {
    const summary = calculateExportSummary([], [], fromDate, toDate, "2026-06");
    expect(summary.total_closed_pnl).toBe(0);
    expect(summary.total_payouts_planned).toBe(0);
    expect(summary.total_payouts_sent).toBe(0);
    expect(summary.total_payouts_received).toBe(0);
  });

  it("trades con pnl no-numérico tratados como 0", () => {
    const trades = [
      { status: "Closed", closed_at: "2026-06-15", pnl: "not-a-number" },
      { status: "Closed", closed_at: "2026-06-15", pnl: null },
    ];
    const summary = calculateExportSummary(trades, [], fromDate, toDate, "2026-06");
    expect(summary.total_closed_pnl).toBe(0);
  });
});

describe("getMonthDateRange", () => {
  it("YYYY-MM válido → from=día 1 UTC, to=último día UTC", () => {
    const { from, to } = getMonthDateRange("2026-06");
    expect(from.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("febrero → 28 días (año no bisiesto)", () => {
    const { to } = getMonthDateRange("2026-02");
    expect(to.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("febrero bisiesto → 29 días", () => {
    const { to } = getMonthDateRange("2024-02");
    expect(to.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("formato inválido (mes 13) → throws", () => {
    expect(() => getMonthDateRange("2026-13")).toThrow(/Invalid month format/);
  });

  it("formato inválido (no parseable) → throws", () => {
    expect(() => getMonthDateRange("not-a-date")).toThrow(/Invalid month format/);
  });

  it("formato inválido (mes 0) → throws", () => {
    expect(() => getMonthDateRange("2026-00")).toThrow(/Invalid month format/);
  });
});
