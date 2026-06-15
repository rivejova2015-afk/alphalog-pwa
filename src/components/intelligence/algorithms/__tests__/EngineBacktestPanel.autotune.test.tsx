// @vitest-environment jsdom
//
// EngineBacktestPanel — Auto-tune SL/TP grid (Mejora #6).
// Verifies the new "Auto-tune SL/TP" button + the results panel + the
// apply-best persistence to algorithms.parameters.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock:   vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));
vi.mock("../EquityCurve", () => ({ EquityCurve: () => null }));
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

// Drive the auto-tune hook deterministically with a controllable mock. We
// re-export the live shape from useAutoTuneStream so the component sees the
// same field names, then mutate the returned state from the test body.
const { hookState, startMock, abortMock, resetMock } = vi.hoisted(() => ({
  hookState: {
    meta: null as unknown,
    trials: [] as Array<Record<string, unknown>>,
    best: null as Record<string, unknown> | null,
    progress: null as { current: number; total: number } | null,
    error: null as string | null,
    isStreaming: false,
    isDone: false,
  },
  startMock: vi.fn(),
  abortMock: vi.fn(),
  resetMock: vi.fn(),
}));
vi.mock("@/hooks/useAutoTuneStream", () => ({
  useAutoTuneStream: () => ({
    ...hookState,
    start: startMock,
    abort: abortMock,
    reset: resetMock,
  }),
}));

import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

function resetHookState() {
  hookState.meta = null;
  hookState.trials = [];
  hookState.best = null;
  hookState.progress = null;
  hookState.error = null;
  hookState.isStreaming = false;
  hookState.isDone = false;
}

function buildFetchMock(opts: { putOk?: boolean; getParams?: Record<string, unknown> } = {}) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const c: { url: string; method: string; body?: unknown } = { url, method: init?.method ?? "GET" };
    if (init?.body) { try { c.body = JSON.parse(init.body as string); } catch { /* noop */ } }
    calls.push(c);
    if (url.includes("/history")) return { ok: true, json: async () => ({ runs: [] }) } as Response;
    if (url.includes("/symbol-status")) return { ok: true, json: async () => ({}) } as Response;
    if (url.match(/\/api\/algorithms\/[^/]+$/) && c.method === "GET") {
      return { ok: true, json: async () => ({ algorithm: { parameters: opts.getParams ?? {} } }) } as Response;
    }
    if (url.match(/\/api\/algorithms\/[^/]+$/) && c.method === "PUT") {
      return { ok: opts.putOk !== false, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

describe("EngineBacktestPanel — Auto-tune SL/TP (Mejora #6)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    startMock.mockReset();
    abortMock.mockReset();
    resetMock.mockReset();
    resetHookState();
  });

  it("renders the Auto-tune SL/TP button", () => {
    buildFetchMock();
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
    expect(screen.getByTestId("auto-tune-button")).toBeDefined();
  });

  it("clicking the button calls reset + start on the hook with the right URL", () => {
    buildFetchMock();
    render(<EngineBacktestPanel algorithmId="algo-7" instruments={["EURUSD"]} />);
    fireEvent.click(screen.getByTestId("auto-tune-button"));
    expect(resetMock).toHaveBeenCalled();
    expect(startMock).toHaveBeenCalledTimes(1);
    const [url, body] = startMock.mock.calls[0];
    expect(url).toBe("/api/algorithms/algo-7/engine-backtest/auto-tune");
    expect(body).toMatchObject({ symbol: "EURUSD" });
  });

  it("shows progress bar while streaming (panel auto-opens via useEffect)", async () => {
    buildFetchMock();
    hookState.isStreaming = true;
    hookState.progress = { current: 5, total: 29 };
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
    // No click needed — the useEffect on isStreaming auto-opens the panel.
    await waitFor(() => expect(screen.queryByTestId("auto-tune-results")).not.toBeNull());
    expect(screen.getByText(/Probando 5\/29 combos/)).toBeDefined();
  });

  it("renders top 5 trials in the table sorted by Sharpe desc", () => {
    buildFetchMock();
    hookState.isDone = true;
    hookState.trials = [
      { slAtrMult: 1.0, tpAtrMult: 2.0, sharpe: 0.5, totalPnl: 100, winRate: 0.5,  maxDrawdownPct: 0.05, trades: 10, index: 1, total: 6 },
      { slAtrMult: 1.5, tpAtrMult: 3.0, sharpe: 1.8, totalPnl: 800, winRate: 0.65, maxDrawdownPct: 0.04, trades: 12, index: 2, total: 6 },
      { slAtrMult: 2.0, tpAtrMult: 3.0, sharpe: 1.2, totalPnl: 400, winRate: 0.55, maxDrawdownPct: 0.06, trades: 8,  index: 3, total: 6 },
      { slAtrMult: 1.0, tpAtrMult: 5.0, sharpe: 1.5, totalPnl: 600, winRate: 0.58, maxDrawdownPct: 0.07, trades: 9,  index: 4, total: 6 },
      { slAtrMult: 2.5, tpAtrMult: 4.0, sharpe: 0.9, totalPnl: 200, winRate: 0.50, maxDrawdownPct: 0.05, trades: 11, index: 5, total: 6 },
      { slAtrMult: 3.0, tpAtrMult: 5.0, sharpe: 0.3, totalPnl: 50,  winRate: 0.48, maxDrawdownPct: 0.04, trades: 7,  index: 6, total: 6 },
    ];
    hookState.best = hookState.trials[1];

    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
    fireEvent.click(screen.getByTestId("auto-tune-button"));
    const panel = screen.getByTestId("auto-tune-results");
    expect(panel).toBeDefined();
    // Best summary line
    expect(screen.getByText(/SL=1\.5 · TP=3\.0 · Sharpe 1\.80/)).toBeDefined();
    // Bottom of top 5 should be the 0.9 sharpe trial, NOT the 0.3 one
    expect(screen.queryByText("0.30")).toBeNull();
    expect(screen.queryByText("0.90")).not.toBeNull();
  });

  it("clicking Aplicar y guardar PUTs merged parameters to /api/algorithms/[id]", async () => {
    const { calls } = buildFetchMock({
      putOk: true,
      // Existing params with kelly already populated — we must preserve them.
      getParams: { kelly_win_rate: 0.55, kelly_avg_win_usd: 100 },
    });
    hookState.isDone = true;
    hookState.trials = [
      { slAtrMult: 1.5, tpAtrMult: 3.0, sharpe: 1.8, totalPnl: 800, winRate: 0.6, maxDrawdownPct: 0.05, trades: 10, index: 1, total: 1 },
    ];
    hookState.best = hookState.trials[0];

    render(<EngineBacktestPanel algorithmId="algo-42" instruments={["EURUSD"]} />);
    fireEvent.click(screen.getByTestId("auto-tune-button"));
    fireEvent.click(screen.getByTestId("auto-tune-apply"));

    await waitFor(() => {
      const putCall = calls.find((c) => c.method === "PUT" && c.url === "/api/algorithms/algo-42");
      expect(putCall).toBeDefined();
      const body = putCall!.body as { parameters: Record<string, unknown> };
      // Auto-tune keys are present
      expect(body.parameters.sl_atr_mult_recommended).toBe(1.5);
      expect(body.parameters.tp_atr_mult_recommended).toBe(3.0);
      expect(body.parameters.auto_tune_best_sharpe).toBe(1.8);
      expect(body.parameters.auto_tune_run_at).toBeDefined();
      // Pre-existing kelly keys are preserved (merge, not overwrite).
      expect(body.parameters.kelly_win_rate).toBe(0.55);
      expect(body.parameters.kelly_avg_win_usd).toBe(100);
    });

    expect(toastSuccessMock).toHaveBeenCalled();
    const successMsg = toastSuccessMock.mock.calls[0][0] as string;
    expect(successMsg).toContain("SL=1.5");
    expect(successMsg).toContain("TP=3");
  });

  it("error event from the stream surfaces in the panel", () => {
    buildFetchMock();
    hookState.error = "no bars available";
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
    fireEvent.click(screen.getByTestId("auto-tune-button"));
    expect(screen.getByText(/no bars available/)).toBeDefined();
  });

  it("Cerrar button aborts the stream and hides the panel", async () => {
    buildFetchMock();
    hookState.isStreaming = true;
    hookState.progress = { current: 2, total: 29 };
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
    await waitFor(() => expect(screen.queryByTestId("auto-tune-results")).not.toBeNull());
    fireEvent.click(screen.getByText("Cerrar"));
    expect(abortMock).toHaveBeenCalled();
    expect(screen.queryByTestId("auto-tune-results")).toBeNull();
  });
});
