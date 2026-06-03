// Wiring test for Gap #4 — verifies that run-job.ts hydrates cfg.multiTfBars
// from Supabase and replaces the orchestrator's 'pending' multiTf block with
// 'completed' (containing tradesFilteredCount + alignment) or 'failed' when
// higher-TF bars are missing.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BacktestConfig, Bar } from "@/types/backtest";

vi.mock("@/lib/backtest/bars-loader", () => ({
  loadHistoricalBars: vi.fn(),
}));
vi.mock("@/lib/backtest/orchestrator", async () => {
  const mod = await vi.importActual<typeof import("@/lib/backtest/orchestrator")>("@/lib/backtest/orchestrator");
  return { ...mod, runFullBacktest: vi.fn() };
});
vi.mock("@/lib/backtest/portfolio", () => ({ runPortfolio: vi.fn() }));
vi.mock("@/lib/quality-gates/runner", () => ({
  computeGates: vi.fn().mockResolvedValue({ score: { gates_passed: 0, tier: "NOT_READY" } }),
}));

import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runFullBacktest } from "@/lib/backtest/orchestrator";
import { runBacktestJob } from "./run-job";

interface UpsertCapture { table: string; payload: Record<string, unknown> }

function makeBars(n: number): Bar[] {
  return Array.from({ length: n }, (_, i) => ({
    ts: new Date(2026, 0, 1, 0, i).toISOString(),
    open: 100, high: 101, low: 99, close: 100, volume: 1000,
  }));
}

function baseCfg(overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  return {
    symbol: "XAUUSD",
    timeframe: "M15",
    from: "2026-01-01T00:00:00Z",
    to:   "2026-03-01T00:00:00Z",
    initialBalance: 10_000,
    contractSize: 100,
    pointValue: 1,
    spreadPoints: 0,
    commissionPerLot: 0,
    slippagePoints: 0,
    direction: "both",
    parameters: {},
    rules: { sizing: { mode: "fixed_lot", value: 0.01 } } as unknown as BacktestConfig["rules"],
    ...overrides,
  };
}

function buildJob(cfg: BacktestConfig) {
  return { id: "job-1", user_id: "user-1", config: cfg, status: "queued", algorithm_id: "algo-1" };
}

function buildSupabase(job: ReturnType<typeof buildJob>, upserts: UpsertCapture[]) {
  const chain = (rows: unknown) => {
    const obj: Record<string, unknown> = {};
    obj.select = vi.fn(() => obj);
    obj.eq    = vi.fn(() => obj);
    obj.update = vi.fn(() => obj);
    obj.upsert = vi.fn(() => Promise.resolve({ error: null }));
    obj.maybeSingle = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    return obj;
  };
  return {
    from: vi.fn((table: string) => {
      const ch = chain(table === "backtest_jobs" ? job : null);
      ch.upsert = vi.fn((payload: Record<string, unknown>) => {
        upserts.push({ table, payload });
        return Promise.resolve({ error: null });
      });
      return ch;
    }),
  };
}

function pendingAdvancedWithMultiTf(higherTimeframes: string[] = ['H4', 'D1']) {
  return {
    ml:      null,
    multiTf: { used: true as const, status: 'pending' as const, higherTimeframes },
    portfolio: null,
  };
}

describe("runBacktestJob — multi-TF wiring (Gap #4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: primary bars + every higher TF returns 200 valid bars.
    (loadHistoricalBars as ReturnType<typeof vi.fn>).mockResolvedValue(makeBars(200));
    (runFullBacktest as ReturnType<typeof vi.fn>).mockImplementation(async (_bars, cfg) => ({
      baseline: {
        metrics: { totalTrades: 5 },
        equityCurve: [],
        finalBalance: 10500,
        durationMs: 42,
        trades: [],
        // Engine attaches multiTfStats when cfg.multiTfBars is populated.
        multiTfStats: (cfg as BacktestConfig).multiTfBars ? {
          tradesFilteredCount: 7,
          alignment: { byTf: { H4: { bull: 80, bear: 20, neutral: 0 }, D1: { bull: 50, bear: 50, neutral: 0 } }, totalPrimaryBars: 100 },
        } : undefined,
      },
      monteCarlo: null, walkForward: null, stress: null, regime: null, robustness: null,
      advanced: pendingAdvancedWithMultiTf(),
      warnings: [],
    }));
  });

  it("useMultiTf=true → loadHistoricalBars is called for each higher TF", async () => {
    const cfg = baseCfg({ useMultiTf: true, multiTfParams: { higherTimeframes: ["H4", "D1"] } });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);
    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");
    // 1 call for primary + 2 for higher TFs
    expect((loadHistoricalBars as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    const tfsLoaded = (loadHistoricalBars as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[2]);
    expect(tfsLoaded).toEqual(expect.arrayContaining(["H4", "D1"]));
  });

  it("hydrates cfg.multiTfBars before invoking the orchestrator", async () => {
    const cfg = baseCfg({ useMultiTf: true, multiTfParams: { higherTimeframes: ["H4", "D1"] } });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);
    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");
    const orchestratorCall = (runFullBacktest as ReturnType<typeof vi.fn>).mock.calls[0];
    const passedCfg = orchestratorCall[1] as BacktestConfig;
    expect(passedCfg.multiTfBars).toBeInstanceOf(Map);
    expect(passedCfg.multiTfBars!.size).toBe(2);
    expect(passedCfg.multiTfBars!.has("H4")).toBe(true);
  });

  it("upsert payload carries advanced.multiTf.status='completed' with tradesFilteredCount + alignment", async () => {
    const cfg = baseCfg({ useMultiTf: true, multiTfParams: { higherTimeframes: ["H4", "D1"] } });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);
    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");
    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    expect(resultsUpsert).toBeDefined();
    const advanced = resultsUpsert!.payload.advanced as {
      multiTf: { status: string; higherTimeframes: string[]; tradesFilteredCount: number; alignment: { byTf: Record<string, unknown> } }
    };
    expect(advanced.multiTf.status).toBe("completed");
    expect(advanced.multiTf.tradesFilteredCount).toBe(7);
    expect(advanced.multiTf.higherTimeframes).toEqual(["H4", "D1"]);
    expect(advanced.multiTf.alignment.byTf.H4).toBeDefined();
  });

  it("every higher TF returns <50 bars → status='failed' with reason", async () => {
    // Primary returns 200, higher TFs each return only 10.
    (loadHistoricalBars as ReturnType<typeof vi.fn>).mockImplementation(async (_s, _sym, tf: string) => {
      return tf === "M15" ? makeBars(200) : makeBars(10);
    });
    const cfg = baseCfg({ useMultiTf: true, multiTfParams: { higherTimeframes: ["H4", "D1"] } });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);
    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");
    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    const advanced = resultsUpsert!.payload.advanced as { multiTf: { status: string; reason: string } };
    expect(advanced.multiTf.status).toBe("failed");
    expect(advanced.multiTf.reason).toMatch(/no higher-TF bars loaded/);
  });

  it("useMultiTf=false → multiTf stays null, no extra loads beyond primary", async () => {
    const cfg = baseCfg();
    (runFullBacktest as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      baseline: { metrics: {}, equityCurve: [], finalBalance: 10000, durationMs: 0, trades: [] },
      monteCarlo: null, walkForward: null, stress: null, regime: null, robustness: null,
      advanced: { ml: null, multiTf: null, portfolio: null },
      warnings: [],
    });
    const upserts: UpsertCapture[] = [];
    const supabase = buildSupabase(buildJob(cfg), upserts);
    await runBacktestJob(supabase as unknown as Parameters<typeof runBacktestJob>[0], "job-1");
    expect((loadHistoricalBars as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    const resultsUpsert = upserts.find((u) => u.table === "backtest_results");
    const advanced = resultsUpsert!.payload.advanced as { multiTf: unknown };
    expect(advanced.multiTf).toBeNull();
  });
});
