import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock simulateEngineV1 so we can drive the trial loop with deterministic
// metrics and assert what the grid runner does with them. The real engine
// has its own tests; here we're testing the orchestration only.
const { simulateMock } = vi.hoisted(() => ({ simulateMock: vi.fn() }));
vi.mock("../backtest", () => ({
  simulateEngineV1: (opts: { slAtrMult: number; tpAtrMult: number }) => simulateMock(opts),
}));

import { runAutoTune, buildGrid, DEFAULT_SL_RANGE, DEFAULT_TP_RANGE } from "../auto-tune";

const noopBaseCfg = {
  symbol: "EURUSD",
  algorithm: {} as never,
  barsByTf: new Map(),
};

function metricsResult(sharpe: number, pnl: number, winRate = 0.5, maxDD = 0.1, trades = 20) {
  return Promise.resolve({
    metrics: { sharpe, totalPnl: pnl, winRate, maxDrawdownPct: maxDD, totalTrades: trades },
    trades: Array.from({ length: trades }, (_, i) => ({ id: i })),
    equityCurve: [],
    finalBalance: 10_000 + pnl,
    durationMs: 100,
  });
}

describe("buildGrid", () => {
  it("returns the full cartesian product when skipDegenerate=false", () => {
    const grid = buildGrid([1, 2], [1, 2, 3], false);
    expect(grid).toHaveLength(6); // 2 × 3
  });

  it("skips combos where tp <= sl when skipDegenerate=true", () => {
    const grid = buildGrid([1, 2], [1, 2, 3], true);
    // (1,1) skipped, (1,2)(1,3) ok, (2,1)(2,2) skipped, (2,3) ok → 3 pairs
    expect(grid).toHaveLength(3);
    expect(grid).toEqual([
      { sl: 1, tp: 2 },
      { sl: 1, tp: 3 },
      { sl: 2, tp: 3 },
    ]);
  });

  it("default ranges produce a 5×7 grid trimmed to 29 effective combos", () => {
    const grid = buildGrid(DEFAULT_SL_RANGE, DEFAULT_TP_RANGE, true);
    // SL [1.0,1.5,2.0,2.5,3.0] × TP [2.0,2.5,3.0,3.5,4.0,4.5,5.0] = 35 raw.
    // skip(tp<=sl): SL=1.0→7, SL=1.5→7, SL=2.0→6, SL=2.5→5, SL=3.0→4 = 29.
    expect(grid).toHaveLength(29);
    grid.forEach((p) => expect(p.tp).toBeGreaterThan(p.sl));
  });
});

describe("runAutoTune", () => {
  beforeEach(() => {
    simulateMock.mockReset();
  });

  it("iterates the full 29-combo default grid (skip degenerate)", async () => {
    simulateMock.mockImplementation(() => metricsResult(0.5, 100));
    const result = await runAutoTune({ baseCfg: noopBaseCfg });
    expect(result.trials).toHaveLength(29);
    expect(simulateMock).toHaveBeenCalledTimes(29);
  });

  it("iterates the full 35 combos when skipDegenerate=false", async () => {
    simulateMock.mockImplementation(() => metricsResult(0.5, 100));
    const result = await runAutoTune({ baseCfg: noopBaseCfg, skipDegenerate: false });
    expect(result.trials).toHaveLength(35);
  });

  it("calls onTrial for each combo with monotonic 1-indexed position", async () => {
    simulateMock.mockImplementation(() => metricsResult(0.5, 100));
    const observed: number[] = [];
    await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [3, 4],
      onTrial: (t) => observed.push(t.index),
    });
    expect(observed).toEqual([1, 2, 3, 4]);
  });

  it("onTrial total field equals trials.length (post-skip count)", async () => {
    simulateMock.mockImplementation(() => metricsResult(0.5, 100));
    const totals: number[] = [];
    await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [1, 2, 3],
      skipDegenerate: true,
      onTrial: (t) => totals.push(t.total),
    });
    // grid: (1,2)(1,3)(2,3) = 3
    expect(totals).toEqual([3, 3, 3]);
  });

  it("best is the trial with the highest Sharpe", async () => {
    const sharpes = [0.5, 1.8, 1.2, 0.9];
    let i = 0;
    simulateMock.mockImplementation(() => metricsResult(sharpes[i++ % sharpes.length], 100));
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [3, 4],
      skipDegenerate: false,
    });
    expect(result.best.sharpe).toBe(1.8);
  });

  it("breaks ties by totalPnl when Sharpes are equal", async () => {
    const data = [
      { sharpe: 1.5, pnl: 500 },
      { sharpe: 1.5, pnl: 800 },  // tie on sharpe, higher pnl
      { sharpe: 1.5, pnl: 200 },
      { sharpe: 0.9, pnl: 9999 }, // higher pnl but lower sharpe — should NOT win
    ];
    let i = 0;
    simulateMock.mockImplementation(() => {
      const d = data[i++ % data.length];
      return metricsResult(d.sharpe, d.pnl);
    });
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [3, 4],
      skipDegenerate: false,
    });
    expect(result.best.sharpe).toBe(1.5);
    expect(result.best.totalPnl).toBe(800);
  });

  it("returns first trial as best when all sharpes are non-finite", async () => {
    simulateMock.mockImplementation(() => metricsResult(NaN, 0));
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1],
      tpRange: [2, 3],
    });
    // Both sharpes are 0 (NaN sanitized) → reducer keeps first
    expect(result.best.slAtrMult).toBe(1);
    expect(result.best.tpAtrMult).toBe(2);
  });

  it("sanitizes NaN/Infinity in metrics to 0", async () => {
    simulateMock.mockResolvedValueOnce({
      metrics: { sharpe: Infinity, totalPnl: NaN, winRate: NaN, maxDrawdownPct: -Infinity, totalTrades: 5 },
      trades: [],
      equityCurve: [],
      finalBalance: 10_000,
      durationMs: 100,
    });
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1],
      tpRange: [2],
    });
    expect(result.trials[0].sharpe).toBe(0);
    expect(result.trials[0].totalPnl).toBe(0);
    expect(result.trials[0].winRate).toBe(0);
    expect(result.trials[0].maxDrawdownPct).toBe(0);
  });

  it("trades count comes from simulateEngineV1 result.trades.length", async () => {
    simulateMock.mockResolvedValueOnce({
      metrics: { sharpe: 1, totalPnl: 100, winRate: 0.6, maxDrawdownPct: 0.05, totalTrades: 999 },
      trades: new Array(42).fill({}),
      equityCurve: [],
      finalBalance: 10_100,
      durationMs: 100,
    });
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1],
      tpRange: [2],
    });
    expect(result.trials[0].trades).toBe(42);
  });

  it("onTrial errors are swallowed so a buggy callback doesn't abort the sweep", async () => {
    simulateMock.mockImplementation(() => metricsResult(0.5, 100));
    const result = await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [3, 4],
      onTrial: () => { throw new Error("UI is on fire"); },
    });
    // All 4 trials still completed despite throwing onTrial
    expect(result.trials).toHaveLength(4);
  });

  it("passes slAtrMult/tpAtrMult overrides to simulateEngineV1 per trial", async () => {
    const calls: Array<{ sl: number; tp: number }> = [];
    simulateMock.mockImplementation((opts) => {
      calls.push({ sl: opts.slAtrMult, tp: opts.tpAtrMult });
      return metricsResult(0.5, 100);
    });
    await runAutoTune({
      baseCfg: noopBaseCfg,
      slRange: [1, 2],
      tpRange: [3, 4],
      skipDegenerate: false,
    });
    expect(calls).toEqual([
      { sl: 1, tp: 3 },
      { sl: 1, tp: 4 },
      { sl: 2, tp: 3 },
      { sl: 2, tp: 4 },
    ]);
  });
});
