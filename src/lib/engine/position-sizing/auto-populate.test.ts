import { describe, it, expect } from "vitest";
import type { BacktestMetrics } from "@/types/backtest";
import { buildKellyInputs, mergeKellyInputs, KELLY_MIN_SAMPLE_TRADES } from "./auto-populate";

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
