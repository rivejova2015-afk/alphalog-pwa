import { describe, expect, it } from "vitest";
import { evaluateEngineGates } from "./quality-gates";
import type { BacktestMetrics } from "@/types/backtest";

function metrics(over: Partial<BacktestMetrics>): BacktestMetrics {
  return {
    totalTrades: 0, wins: 0, losses: 0, winRate: 0, totalPnl: 0, totalReturnPct: 0,
    profitFactor: 0, expectancy: 0, sharpe: 0, sortino: 0, calmar: 0,
    maxDrawdown: 0, maxDrawdownPct: 0, recoveryFactor: 0, avgWin: 0, avgLoss: 0,
    avgWinLossRatio: 0, consecutiveWinsMax: 0, consecutiveLossesMax: 0, k_ratio: 0,
    ...over,
  };
}

describe("evaluateEngineGates", () => {
  it("is not eligible on an empty result", () => {
    const e = evaluateEngineGates(metrics({}));
    expect(e.allMustPassed).toBe(false);
    expect(e.eligibleForPaper).toBe(false);
    // 0% drawdown trivially clears the DD cap, but trades/PF/PnL all fail.
    expect(e.mustPassed).toBeLessThan(e.mustTotal);
  });

  it("passes all must gates on a solid strategy", () => {
    const e = evaluateEngineGates(metrics({
      totalTrades: 50,
      profitFactor: 1.6,
      totalPnl: 1200,
      maxDrawdownPct: 0.12,
    }));
    expect(e.allMustPassed).toBe(true);
    expect(e.eligibleForPaper).toBe(true);
    expect(e.mustPassed).toBe(e.mustTotal);
  });

  it("blocks promotion when drawdown exceeds the cap", () => {
    const e = evaluateEngineGates(metrics({
      totalTrades: 50,
      profitFactor: 1.6,
      totalPnl: 1200,
      maxDrawdownPct: 0.40,  // > 25% cap
    }));
    expect(e.allMustPassed).toBe(false);
    expect(e.eligibleForPaper).toBe(false);
    const ddGate = e.results.find((r) => r.key === "maxDrawdownPct");
    expect(ddGate?.passed).toBe(false);
  });

  it("blocks promotion below the trade-count floor", () => {
    const e = evaluateEngineGates(metrics({
      totalTrades: 5,         // < 20
      profitFactor: 2.0,
      totalPnl: 800,
      maxDrawdownPct: 0.05,
    }));
    expect(e.allMustPassed).toBe(false);
  });

  it("should gates are advisory — don't block eligibility", () => {
    const e = evaluateEngineGates(metrics({
      totalTrades: 30,
      profitFactor: 1.3,
      totalPnl: 400,
      maxDrawdownPct: 0.20,
      // should gates all left at 0 → fail
      winRate: 0, sharpe: 0, expectancy: 0,
    }));
    expect(e.allMustPassed).toBe(true);
    expect(e.eligibleForPaper).toBe(true);
    expect(e.shouldPassed).toBeLessThan(e.shouldTotal);
  });

  it("treats non-finite metric values as null/failed", () => {
    const e = evaluateEngineGates(metrics({
      totalTrades: 50,
      profitFactor: NaN,
      totalPnl: 1000,
      maxDrawdownPct: 0.1,
    }));
    const pf = e.results.find((r) => r.key === "profitFactor");
    expect(pf?.value).toBeNull();
    expect(pf?.passed).toBe(false);
    expect(e.allMustPassed).toBe(false);
  });
});
