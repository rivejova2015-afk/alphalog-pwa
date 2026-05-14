import { describe, expect, it } from "vitest";
import { evaluatePaperGates, type PaperTrade } from "./paper-gates";

const NOW = new Date("2026-05-20T00:00:00Z");

function trade(pnl: number, daysAgoOpened: number, closed = true): PaperTrade {
  const openedMs = NOW.getTime() - daysAgoOpened * 24 * 60 * 60 * 1000;
  return {
    pnl,
    status: closed ? "closed" : "open",
    opened_at: new Date(openedMs).toISOString(),
    closed_at: closed ? new Date(openedMs + 3_600_000).toISOString() : null,
  };
}

describe("evaluatePaperGates", () => {
  it("not eligible with zero trades", () => {
    const e = evaluatePaperGates([], NOW);
    expect(e.eligibleForApproved).toBe(false);
    expect(e.closedTrades).toBe(0);
  });

  it("eligible when all must gates pass", () => {
    // 20 trades over 10 days, 60% winners, net positive
    const trades: PaperTrade[] = [];
    for (let i = 0; i < 20; i++) {
      const win = i % 5 < 3;  // 12 wins / 8 losses = 60%
      trades.push(trade(win ? 50 : -30, 10 - i * 0.4));
    }
    const e = evaluatePaperGates(trades, NOW);
    expect(e.allMustPassed).toBe(true);
    expect(e.eligibleForApproved).toBe(true);
    expect(e.closedTrades).toBe(20);
    expect(e.totalPnl).toBeGreaterThan(0);
  });

  it("blocks when below the trade-count floor", () => {
    const trades = Array.from({ length: 5 }, (_, i) => trade(40, 8 - i));
    const e = evaluatePaperGates(trades, NOW);
    expect(e.eligibleForApproved).toBe(false);
    expect(e.results.find((r) => r.key === "closed_trades")?.passed).toBe(false);
  });

  it("blocks when not enough days live", () => {
    // 20 trades but all opened today
    const trades = Array.from({ length: 20 }, () => trade(40, 0.1));
    const e = evaluatePaperGates(trades, NOW);
    expect(e.eligibleForApproved).toBe(false);
    expect(e.results.find((r) => r.key === "days_live")?.passed).toBe(false);
  });

  it("blocks on negative aggregate PnL", () => {
    const trades = Array.from({ length: 20 }, (_, i) => trade(-10, 10 - i * 0.4));
    const e = evaluatePaperGates(trades, NOW);
    expect(e.eligibleForApproved).toBe(false);
    expect(e.results.find((r) => r.key === "total_pnl")?.passed).toBe(false);
  });

  it("ignores open trades — only closed count", () => {
    const closed = Array.from({ length: 16 }, (_, i) => trade(40, 10 - i * 0.5));
    const open = Array.from({ length: 10 }, () => trade(0, 1, false));
    const e = evaluatePaperGates([...closed, ...open], NOW);
    expect(e.closedTrades).toBe(16);
  });

  it("profit_factor is advisory (should) — doesn't block eligibility", () => {
    // 20 trades, marginally positive: wins barely outweigh losses, PF < 1.2
    const trades: PaperTrade[] = [];
    for (let i = 0; i < 20; i++) {
      const win = i % 2 === 0;       // 50% win rate
      trades.push(trade(win ? 11 : -10, 10 - i * 0.4));
    }
    const e = evaluatePaperGates(trades, NOW);
    expect(e.allMustPassed).toBe(true);
    expect(e.eligibleForApproved).toBe(true);
    const pf = e.results.find((r) => r.key === "profit_factor");
    expect(pf?.tier).toBe("should");
  });
});
