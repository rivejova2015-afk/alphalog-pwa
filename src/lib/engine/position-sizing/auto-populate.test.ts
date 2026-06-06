import { describe, it, expect } from "vitest";
import type { BacktestMetrics } from "@/types/backtest";
import {
  buildKellyInputs,
  buildKellyInputsFromTrades,
  mergeKellyInputs,
  KELLY_MIN_SAMPLE_TRADES,
  type ClosedTrade,
} from "./auto-populate";

const baseMetrics: BacktestMetrics = {
  totalTrades:          50,
  wins:                 30,
  losses:               20,
  winRate:              0.6,
  totalPnl:             1500,
  totalReturnPct:       0.15,
  profitFactor:         1.8,
  expectancy:           30,
  sharpe:               1.2,
  sortino:              1.8,
  calmar:               1.0,
  maxDrawdown:          500,
  maxDrawdownPct:       0.05,
  recoveryFactor:       3.0,
  avgWin:               80,
  avgLoss:              40,
  avgWinLossRatio:      2.0,
  consecutiveWinsMax:   5,
  consecutiveLossesMax: 3,
  k_ratio:              1.5,
};

const opts = { sourceTag: "engine_backtest:abc-123", nowIso: "2026-06-05T00:00:00Z" };

describe("buildKellyInputs", () => {
  it("returns the 3 Kelly inputs + metadata when the sample is large enough", () => {
    const out = buildKellyInputs(baseMetrics, opts);
    expect(out).not.toBeNull();
    expect(out!.kelly_win_rate).toBe(0.6);
    expect(out!.kelly_avg_win_usd).toBe(80);
    expect(out!.kelly_avg_loss_usd).toBe(40);
    expect(out!.kelly_inputs_source).toBe("engine_backtest:abc-123");
    expect(out!.kelly_inputs_updated_at).toBe("2026-06-05T00:00:00Z");
    expect(out!.kelly_inputs_sample_size).toBe(50);
  });

  it("returns null when sample is below the default 30-trade floor", () => {
    const out = buildKellyInputs({ ...baseMetrics, totalTrades: 25 }, opts);
    expect(out).toBeNull();
  });

  it("respects custom minTrades override", () => {
    const out = buildKellyInputs({ ...baseMetrics, totalTrades: 25 }, { ...opts, minTrades: 20 });
    expect(out).not.toBeNull();
  });

  it("returns null when win rate is 0 (no wins)", () => {
    const out = buildKellyInputs({ ...baseMetrics, winRate: 0 }, opts);
    expect(out).toBeNull();
  });

  it("returns null when win rate is 1 (no losses — Kelly undefined with avgLoss)", () => {
    const out = buildKellyInputs({ ...baseMetrics, winRate: 1, avgLoss: 0 }, opts);
    expect(out).toBeNull();
  });

  it("returns null when avgWin is 0", () => {
    const out = buildKellyInputs({ ...baseMetrics, avgWin: 0 }, opts);
    expect(out).toBeNull();
  });

  it("returns null when avgLoss is 0", () => {
    const out = buildKellyInputs({ ...baseMetrics, avgLoss: 0 }, opts);
    expect(out).toBeNull();
  });

  it("exposes the 30-trade floor as a named constant", () => {
    expect(KELLY_MIN_SAMPLE_TRADES).toBe(30);
  });
});

describe("mergeKellyInputs", () => {
  it("merges payload into existing params without disturbing other keys", () => {
    const existing = {
      contracts_per_trade: 2,
      kelly_enabled:       true,
      kelly_fraction:      0.25,
      sl_atr_mult:         1.5,
      cme_account_id:      "uuid-abc",
    };
    const payload = buildKellyInputs(baseMetrics, opts)!;
    const merged  = mergeKellyInputs(existing, payload);

    expect(merged.contracts_per_trade).toBe(2);
    expect(merged.kelly_enabled).toBe(true);
    expect(merged.kelly_fraction).toBe(0.25);
    expect(merged.sl_atr_mult).toBe(1.5);
    expect(merged.cme_account_id).toBe("uuid-abc");
    expect(merged.kelly_win_rate).toBe(0.6);
    expect(merged.kelly_avg_win_usd).toBe(80);
    expect(merged.kelly_avg_loss_usd).toBe(40);
  });

  it("overwrites stale Kelly inputs from a previous run", () => {
    const existing = {
      kelly_win_rate:     0.45,
      kelly_avg_win_usd:  20,
      kelly_avg_loss_usd: 15,
      kelly_inputs_source: "engine_backtest:OLD",
    };
    const payload = buildKellyInputs(baseMetrics, opts)!;
    const merged  = mergeKellyInputs(existing, payload);

    expect(merged.kelly_win_rate).toBe(0.6);
    expect(merged.kelly_avg_win_usd).toBe(80);
    expect(merged.kelly_inputs_source).toBe("engine_backtest:abc-123");
  });

  it("handles null/undefined existing params gracefully", () => {
    const payload = buildKellyInputs(baseMetrics, opts)!;
    const mergedFromNull      = mergeKellyInputs(null, payload);
    const mergedFromUndefined = mergeKellyInputs(undefined, payload);
    expect(mergedFromNull.kelly_win_rate).toBe(0.6);
    expect(mergedFromUndefined.kelly_win_rate).toBe(0.6);
  });
});

describe("buildKellyInputsFromTrades", () => {
  const tOpts = { sourceTag: "paper_trades:algo-xyz", nowIso: "2026-06-05T00:00:00Z" };

  function makeTrades(wins: number, losses: number, avgWin: number, avgLoss: number): ClosedTrade[] {
    const out: ClosedTrade[] = [];
    for (let i = 0; i < wins; i++)   out.push({ pnl:  avgWin,        status: "closed" });
    for (let i = 0; i < losses; i++) out.push({ pnl: -avgLoss,       status: "closed" });
    return out;
  }

  it("returns null when sample size is below the 30-trade floor", () => {
    const trades = makeTrades(10, 10, 100, 50);
    expect(buildKellyInputsFromTrades(trades, tOpts)).toBeNull();
  });

  it("computes payload from a profitable paper history", () => {
    const trades = makeTrades(20, 15, 120, 60);
    const out = buildKellyInputsFromTrades(trades, tOpts);
    expect(out).not.toBeNull();
    expect(out!.kelly_win_rate).toBeCloseTo(20 / 35, 4);
    expect(out!.kelly_avg_win_usd).toBe(120);
    expect(out!.kelly_avg_loss_usd).toBe(60);
    expect(out!.kelly_inputs_sample_size).toBe(35);
    expect(out!.kelly_inputs_source).toBe("paper_trades:algo-xyz");
  });

  it("ignores open / non-closed trades", () => {
    const trades: ClosedTrade[] = [
      ...makeTrades(20, 15, 100, 50),
      { pnl: 5000,    status: "open" },     // ignored
      { pnl: null,    status: "pending" },  // ignored
    ];
    const out = buildKellyInputsFromTrades(trades, tOpts)!;
    expect(out.kelly_inputs_sample_size).toBe(35);
    expect(out.kelly_avg_win_usd).toBe(100);
  });

  it("returns null when there are no winning trades", () => {
    const trades = makeTrades(0, 40, 0, 50);
    expect(buildKellyInputsFromTrades(trades, tOpts)).toBeNull();
  });

  it("returns null when there are no losing trades (winRate=1)", () => {
    const trades = makeTrades(40, 0, 100, 0);
    expect(buildKellyInputsFromTrades(trades, tOpts)).toBeNull();
  });

  it("treats pnl=0 trades as part of sample but neutral to win/loss", () => {
    const wins   = makeTrades(20, 0, 100, 0);
    const losses = makeTrades(0, 15, 0, 50);
    const breakEven: ClosedTrade[] = Array.from({ length: 5 }, () => ({ pnl: 0, status: "closed" }));
    const out = buildKellyInputsFromTrades([...wins, ...losses, ...breakEven], tOpts)!;
    expect(out.kelly_inputs_sample_size).toBe(40);
    expect(out.kelly_win_rate).toBeCloseTo(20 / 40, 4);
    // avg_loss counts the 5 break-evens as part of the loss denominator.
    expect(out.kelly_avg_loss_usd).toBeCloseTo((15 * 50) / 20, 2);
  });
});
