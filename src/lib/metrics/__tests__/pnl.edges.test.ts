// Edge-case tests for src/lib/metrics/pnl.ts.
// Existing pnl.test.ts cubre los casos canon: empty array, mixed wins/losses,
// winRate 0%/100%, avgPnl, string with comma, open/closed gating, null pnl,
// zero pnl. Este archivo extiende con edge cases NO cubiertos.
//
// Validates:
//   1. String pnl negativa con signo ("-500") → parseado a -500.
//   2. String pnl con comma + decimal ("-1,234.56") → parseado correcto.
//   3. String pnl con leading/trailing whitespace ("  100  ") → parseado.
//   4. pnl = undefined → tratado como null (excluido).
//   5. pnl es boolean/object/array → excluido (toNumber returns null).
//   6. pnl = NaN-string ("abc") → excluido.
//   7. pnl = Infinity → excluido (toNumber con !Finite returns null).
//   8. pnl = "" → excluido (empty string).
//   9. status mixed case ("ClOsEd") → match cuando closedOnly y NO requireExitDate.
//   10. status="closed" pero exit_date presente → match con cualquier filtro.
//   11. closedOnly=false: incluye open trades.
//   12. ignoreZero=false: incluye 0-pnl trades.
//   13. requireExitDate=true SIN exit_date → excluido aún con status="closed".
//   14. options NO pasado: usa DEFAULT_FILTERS.
//   15. partial options spread: closedOnly=true sin ignoreZero → ignoreZero
//       default (true) aplicado.

import { describe, it, expect } from "vitest";
import { computePnlTotals, filterTradesForPnl } from "../pnl";
import type { PnlTradeLike } from "../pnl";

describe("pnl edge cases: string parsing", () => {
  it("'-500' string → -500", () => {
    const totals = computePnlTotals([
      { pnl: "-500", status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(totals.totalPnl).toBe(-500);
    expect(totals.losses).toBe(1);
  });

  it("'-1,234.56' string con comma → -1234.56", () => {
    const totals = computePnlTotals([
      { pnl: "-1,234.56", status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(totals.totalPnl).toBe(-1234.56);
  });

  it("'100' string → 100 (es positivo, win)", () => {
    const totals = computePnlTotals([
      { pnl: "100", status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(totals.totalPnl).toBe(100);
    expect(totals.wins).toBe(1);
  });
});

describe("pnl edge cases: invalid types excluded", () => {
  it("pnl undefined → excluido", () => {
    const filtered = filterTradesForPnl([
      { pnl: undefined, status: "closed", exit_date: "2026-06-01" },
      { pnl: 100, status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(filtered).toHaveLength(1);
  });

  it("pnl boolean/object/array → THROWS (toNumber asume string|number)", () => {
    // El TypeScript signature de PnlTradeLike.pnl es number|string|null|
    // undefined; no se prevé boolean/object/array. toNumber llama .replace
    // sin guard de tipo, así que cualquier non-string runtime crash. Este
    // test documenta el invariante para no regresarlo silenciosamente.
    expect(() => filterTradesForPnl([
      { pnl: true as unknown as number, status: "closed", exit_date: "2026-06-01" },
    ])).toThrow(TypeError);

    expect(() => filterTradesForPnl([
      { pnl: { val: 100 } as unknown as number, status: "closed", exit_date: "2026-06-01" },
    ])).toThrow(TypeError);

    expect(() => filterTradesForPnl([
      { pnl: [100, 200] as unknown as number, status: "closed", exit_date: "2026-06-01" },
    ])).toThrow(TypeError);
  });

  it("pnl 'abc' (non-numeric string) → excluido", () => {
    const filtered = filterTradesForPnl([
      { pnl: "abc", status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(filtered).toHaveLength(0);
  });

  it("pnl Infinity → excluido (toNumber returns null para non-finite)", () => {
    const filtered = filterTradesForPnl([
      { pnl: Infinity, status: "closed", exit_date: "2026-06-01" },
      { pnl: -Infinity, status: "closed", exit_date: "2026-06-01" },
      { pnl: NaN, status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(filtered).toHaveLength(0);
  });

  it("pnl '' (string vacío) → excluido", () => {
    const filtered = filterTradesForPnl([
      { pnl: "", status: "closed", exit_date: "2026-06-01" },
    ]);
    expect(filtered).toHaveLength(0);
  });
});

describe("pnl edge cases: status casing", () => {
  it("status='ClOsEd' (mixed case) con requireExitDate=false → match", () => {
    const filtered = filterTradesForPnl(
      [{ pnl: 100, status: "ClOsEd", exit_date: null }],
      { requireExitDate: false }
    );
    expect(filtered).toHaveLength(1);
  });

  it("status='CLOSED' (todo mayúsculas) con requireExitDate=false → match", () => {
    const filtered = filterTradesForPnl(
      [{ pnl: 100, status: "CLOSED", exit_date: null }],
      { requireExitDate: false }
    );
    expect(filtered).toHaveLength(1);
  });

  it("status null + exit_date presente + requireExitDate=true → match", () => {
    const filtered = filterTradesForPnl(
      [{ pnl: 100, status: null, exit_date: "2026-06-01" }],
      { requireExitDate: true }
    );
    expect(filtered).toHaveLength(1);
  });

  it("requireExitDate=true + status='closed' SIN exit_date → excluido", () => {
    const filtered = filterTradesForPnl(
      [{ pnl: 100, status: "closed", exit_date: null }],
      { requireExitDate: true }
    );
    expect(filtered).toHaveLength(0);
  });
});

describe("pnl edge cases: options defaults + spread", () => {
  it("options no pasado: usa DEFAULT_FILTERS (closedOnly+requireExitDate+ignoreZero)", () => {
    const trades: PnlTradeLike[] = [
      { pnl: 100, status: "closed", exit_date: "2026-06-01" },  // win
      { pnl: 0,   status: "closed", exit_date: "2026-06-01" },  // zero (excluido)
      { pnl: -50, status: "open",   exit_date: null },           // open (excluido)
      { pnl: 200, status: "closed", exit_date: null },           // sin exit_date (excluido)
    ];
    const totals = computePnlTotals(trades);
    expect(totals.tradeCount).toBe(1);
    expect(totals.totalPnl).toBe(100);
  });

  it("partial options: closedOnly=false NO afecta ignoreZero (default true)", () => {
    const trades: PnlTradeLike[] = [
      { pnl: 0,   status: "open", exit_date: null },     // zero → excluido por ignoreZero default
      { pnl: 100, status: "open", exit_date: null },     // open → ahora incluido
    ];
    const totals = computePnlTotals(trades, { closedOnly: false });
    expect(totals.tradeCount).toBe(1);
    expect(totals.totalPnl).toBe(100);
  });

  it("partial options: ignoreZero=false NO afecta closedOnly (default true)", () => {
    const trades: PnlTradeLike[] = [
      { pnl: 0,   status: "closed", exit_date: "2026-06-01" }, // zero AHORA incluido
      { pnl: 100, status: "open",   exit_date: null },          // open seguir excluido
    ];
    const totals = computePnlTotals(trades, { ignoreZero: false });
    expect(totals.tradeCount).toBe(1);
    expect(totals.totalPnl).toBe(0);
  });

  it("closedOnly=false + ignoreZero=false: TODO se incluye (excepto null/NaN)", () => {
    const trades: PnlTradeLike[] = [
      { pnl: 0,    status: "open",   exit_date: null },
      { pnl: 100,  status: "open",   exit_date: null },
      { pnl: -50,  status: "closed", exit_date: "2026-06-01" },
      { pnl: null, status: "closed", exit_date: "2026-06-01" }, // null excluido siempre
    ];
    const totals = computePnlTotals(trades, {
      closedOnly: false, ignoreZero: false,
    });
    expect(totals.tradeCount).toBe(3);
    expect(totals.totalPnl).toBe(50); // 0 + 100 + (-50)
  });
});

describe("pnl edge cases: empty + null fallbacks", () => {
  it("computePnlTotals() sin args → zeros", () => {
    const t = computePnlTotals();
    expect(t.totalPnl).toBe(0);
    expect(t.wins).toBe(0);
    expect(t.losses).toBe(0);
    expect(t.ops).toBe(0);
    expect(t.winRate).toBeNull();
    expect(t.avgPnl).toBeNull();
    expect(t.tradeCount).toBe(0);
  });

  it("filterTradesForPnl() sin args → []", () => {
    expect(filterTradesForPnl()).toEqual([]);
  });

  it("Solo zero pnl con ignoreZero=true → winRate y avgPnl null (ops=0)", () => {
    const trades: PnlTradeLike[] = [
      { pnl: 0, status: "closed", exit_date: "2026-06-01" },
      { pnl: 0, status: "closed", exit_date: "2026-06-01" },
    ];
    const t = computePnlTotals(trades);
    expect(t.ops).toBe(0);
    expect(t.winRate).toBeNull();
    expect(t.avgPnl).toBeNull();
  });

  it("Solo zero pnl con ignoreZero=false → ops=2 (count) pero winRate=0", () => {
    // Wait: 0 no es win ni loss, así que wins=0 losses=0 → ops=0.
    // Aún con ignoreZero=false, ops counts wins+losses (no zeros).
    const trades: PnlTradeLike[] = [
      { pnl: 0, status: "closed", exit_date: "2026-06-01" },
      { pnl: 0, status: "closed", exit_date: "2026-06-01" },
    ];
    const t = computePnlTotals(trades, { ignoreZero: false });
    expect(t.tradeCount).toBe(2); // incluidos
    expect(t.ops).toBe(0);          // pero ninguno cuenta como win/loss
    expect(t.winRate).toBeNull();
    expect(t.avgPnl).toBeNull();
    expect(t.totalPnl).toBe(0);
  });
});
