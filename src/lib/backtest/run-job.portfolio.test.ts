// Wiring test for Gap #2 — verifies that run-job.ts replaces the orchestrator's
// `advanced.portfolio: { status: 'pending' }` block with the real result after
// calling runPortfolio with weight-scaled per-leg cfg clones. Uses chainable
// Supabase mocks + mocked module boundaries (loadHistoricalBars, runFullBacktest,
// runPortfolio, computeGates) to keep the test surface narrow.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BacktestConfig } from "@/types/backtest";

vi.mock("@/lib/backtest/bars-loader", () => ({
  loadHistoricalBars: vi.fn(),
}));
vi.mock("@/lib/backtest/orchestrator", async () => {
  const mod = await vi.importActual<typeof import("@/lib/backtest/orchestrator")>("@/lib/backtest/orchestrator");
  return { ...mod, runFullBacktest: vi.fn() };
});
vi.mock("@/lib/backtest/portfolio", () => ({
  runPortfolio: vi.fn(),
}));
vi.mock("@/lib/quality-gates/runner", () => ({
  computeGates: vi.fn().mockResolvedValue({ score: { gates_passed: 0, tier: "NOT_READY" } }),
}));

import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runFullBacktest } from "@/lib/backtest/orchestrator";
import { runPortfolio } from "@/lib/backtest/portfolio";
import { runBacktestJob } from "./run-job";

interface UpsertCapture { table: string; payload: Record<string, unknown> }

function buildJob(cfg: BacktestConfig) {
  return {
    id: "job-1",
    user_id: "user-1",
    config: cfg,
    status: "queued",
    algorithm_id: "algo-1",
  };
}

function buildSupabase(job: ReturnType<typeof buildJob>, upserts: UpsertCapture[]) {
  // Minimal chainable mock — only the methods run-job.ts actually calls.
  const chain = (rows: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.select = vi.fn(() => obj);
    obj.eq    = vi.fn(() => obj);
    obj.update = vi.fn(() => obj);
    obj.upsert = vi.fn((payload: Record<string, unknown>) => {
      upserts.push({ table: "(pending)", payload });
      return Promise.resolve({ error: null });
    });
    obj.maybeSingle = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    return obj;
  };
  return {
    from: vi.fn((table: string) => {
      const ch = chain(table === "backtest_jobs" ? job : null);
      // tag the upsert with the table name when it fires
      const origUpsert = ch.upsert as unknown as ReturnType<typeof vi.fn>;
      ch.upsert = vi.fn((payload: Record<string, unknown>) => {
        upserts.push({ table, payload });
        return Promise.resolve({ error: null });
      });
      void origUpsert;
      return ch;
    }),
  };
}

function baseCfg(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol:           "XAUUSD",
    timeframe:        "M15",
    from:             "2026-01-01T00:00:00Z",
    to:               "2026-03-01T00:00:00Z",
    initialBalance:   10_000,
    contractSize:     100,
    pointValue:       1,
    spreadPoints:     0,
    commissionPerLot: 0,
    slippagePoints:   0,
    direction:        "both",
    parameters:       {},
    rules: { sizing: { mode: "fixed_lot", value: 0.01 } } as unknown as BacktestConfig["rules"],
    ...overrides,
  };
}

function pendingAdvanced() {
  return {
    ml:        null,
    multiTf:   null,
    portfolio: { used: true as const, status: "pending" as const, reason: "stub" },
  };
}

describe("runBacktestJob — portfolio wiring (Gap #2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadHistoricalBars as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        ts: new Date(2026, 0, 1, 0, i).toISOString(),
        open: 100, high: 101, low: 99, close: 100, volume: 1000,
      })),
    );
    (runFullBacktest as ReturnType<typeof vi.fn>).mockResolvedValue({
      baseline: {
        metrics: { totalTrades: 5 },
        equityCurve: [{ ts: "2026-01-01T00:00:00Z", equity: 10000, drawdown: 0 }],
        finalBalance: 10500,
        durationMs: 42,
        trades: [],
      },
      monteCarlo: null,
      walkForward: null,
      stress: null,
      regime: null,
      robustness: null,
      advanced: pendingAdvanced(),
      warnings: [],
    });
  });

  it("portfolio with 2+ legs → runPortfolio called with weight-scaled cloned cfgs", async () => {
    (runPortfolio as ReturnType<typeof vi.fn>).mockResolvedValue({
      legs: [],
      portfolioEquity: Array.from({ length: 60 }, (_, i) => ({
        ts: new Date(2026, 0, 1, 0, i).toISOString(), equity: 10000 + i, drawdown: 0,
      })),
      metrics: {
        totalPnl: 59, totalReturnPct: 0.59, sharpe: 1.8,
        maxDrawdown: 12, maxDrawdownPct: 0.12, legCorrelations: [],
      },
    });

    const cfg = baseCfg({
      usePortfolio: true,
      portfolioLegs: [
        { configId: "leg-eur", symbol: "EURUSD", weight: 0.6 },
        { configId: "leg-xau", symbol: "XAUUSD", weight: 0.4 },
      ],
    });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);

    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");

    expect(runPortfolio).toHaveBeenCalledTimes(1);
    const passedLegs = (runPortfolio as ReturnType<typeof vi.fn>).mock.calls[0][1] as Array<{
      symbol: string; weight: number; cfg: { symbol: string; initialBalance: number }
    }>;
    expect(passedLegs).toHaveLength(2);
    expect(passedLegs[0].cfg.symbol).toBe("EURUSD");
    expect(passedLegs[0].cfg.initialBalance).toBeCloseTo(6000); // 10000 * 0.6
    expect(passedLegs[1].cfg.symbol).toBe("XAUUSD");
    expect(passedLegs[1].cfg.initialBalance).toBeCloseTo(4000); // 10000 * 0.4
  });

  it("upsert payload carries advanced.portfolio.status='completed' with metrics + equityPreviewLast50", async () => {
    (runPortfolio as ReturnType<typeof vi.fn>).mockResolvedValue({
      legs: [],
      portfolioEquity: Array.from({ length: 200 }, (_, i) => ({
        ts: new Date(2026, 0, 1, 0, i).toISOString(), equity: 10000 + i, drawdown: 0,
      })),
      metrics: {
        totalPnl: 199, totalReturnPct: 1.99, sharpe: 2.1,
        maxDrawdown: 8, maxDrawdownPct: 0.08, legCorrelations: [{ a: "leg-a", b: "leg-b", rho: 0.4 }],
      },
    });

    const cfg = baseCfg({
      usePortfolio: true,
      portfolioLegs: [
        { configId: "leg-a", symbol: "EURUSD", weight: 0.5 },
        { configId: "leg-b", symbol: "GBPUSD", weight: 0.5 },
      ],
    });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);

    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");

    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    expect(resultsUpsert).toBeDefined();
    const advanced = resultsUpsert!.payload.advanced as {
      portfolio: { status: string; legCount: number; metrics: { sharpe: number }; equityPreviewLast50: unknown[] }
    };
    expect(advanced.portfolio.status).toBe("completed");
    expect(advanced.portfolio.legCount).toBe(2);
    expect(advanced.portfolio.metrics.sharpe).toBe(2.1);
    expect(advanced.portfolio.equityPreviewLast50).toHaveLength(50);
  });

  it("runPortfolio throws → portfolio block downgraded to status='failed' with reason", async () => {
    (runPortfolio as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("missing bars for GBPUSD"));

    const cfg = baseCfg({
      usePortfolio: true,
      portfolioLegs: [
        { configId: "leg-a", symbol: "EURUSD", weight: 0.5 },
        { configId: "leg-b", symbol: "GBPUSD", weight: 0.5 },
      ],
    });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);

    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");

    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    const advanced = resultsUpsert!.payload.advanced as { portfolio: { status: string; reason: string } };
    expect(advanced.portfolio.status).toBe("failed");
    expect(advanced.portfolio.reason).toMatch(/missing bars/);
  });

  it("only 1 leg in portfolioLegs → portfolio status='failed' (no runPortfolio call)", async () => {
    const cfg = baseCfg({
      usePortfolio: true,
      portfolioLegs: [{ configId: "leg-a", symbol: "EURUSD", weight: 1.0 }],
    });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);

    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");

    expect(runPortfolio).not.toHaveBeenCalled();
    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    const advanced = resultsUpsert!.payload.advanced as { portfolio: { status: string; reason: string } };
    expect(advanced.portfolio.status).toBe("failed");
    expect(advanced.portfolio.reason).toMatch(/at least 2 legs/);
  });

  it("usePortfolio=false → advanced.portfolio stays null, runPortfolio not called", async () => {
    (runFullBacktest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      baseline: { metrics: {}, equityCurve: [], finalBalance: 10000, durationMs: 0, trades: [] },
      monteCarlo: null, walkForward: null, stress: null, regime: null, robustness: null,
      advanced: { ml: null, multiTf: null, portfolio: null },
      warnings: [],
    });

    const cfg = baseCfg();
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);

    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");

    expect(runPortfolio).not.toHaveBeenCalled();
    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    const advanced = resultsUpsert!.payload.advanced as { portfolio: unknown };
    expect(advanced.portfolio).toBeNull();
  });
});
