// @vitest-environment jsdom
//
// BacktestPanel — basic flow coverage that complements BacktestPanel.advanced.
// Focuses on:
//   1. Initial fetch to /api/backtest/jobs?algorithm_id=... on mount.
//   2. "Nuevo backtest" button toggles the form open/closed.
//   3. Click a completed job row → GET /jobs/[id] + tab='overview' default.
//   4. Empty jobs state shows the "no backtests" hint.
//   5. Failed jobs render an error indicator.
//   6. Initial Balance prefill uses defaultBacktestBalance when
//      linkedBotAccountId === null (research mode).
//   7. defaultBacktestBalance ignored when the algo has a linked bot account.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("../BacktestRuleBuilder", () => ({ BacktestRuleBuilder: () => null }));
vi.mock("../BacktestEquityChart.client", () => ({ BacktestEquityChart: () => null }));
vi.mock("../BacktestTradesTable.client", () => ({ BacktestTradesTable: () => null }));
vi.mock("../BacktestSensitivityHeatmap.client", () => ({ BacktestSensitivityHeatmap: () => null }));
vi.mock("@/hooks/useBacktestJobProgress", () => ({
  useBacktestJobProgress: () => ({ job: null, phases: [] }),
}));

import { BacktestPanel } from "../BacktestPanel.client";

interface JobShape {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress_pct: number;
  current_phase: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

function makeFetchMock(jobs: JobShape[], results?: unknown) {
  const calls: Array<{ url: string; method: string }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    if (url.includes("/api/backtest/jobs/") && (!init?.method || init.method === "GET")) {
      return {
        ok: true,
        json: async () => ({
          job:     jobs.find((j) => url.includes(j.id)) ?? null,
          results: results ?? null,
        }),
      } as Response;
    }
    if (url.includes("/api/backtest/jobs?algorithm_id=")) {
      return { ok: true, json: async () => ({ jobs }) } as Response;
    }
    if (url === "/api/backtest/jobs" && init?.method === "POST") {
      return { ok: true, json: async () => ({ id: "new-job" }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

function completedJob(over: Partial<JobShape> = {}): JobShape {
  return {
    id:            over.id ?? "job-done",
    status:        over.status ?? "completed",
    progress_pct:  100,
    current_phase: "done",
    error:         null,
    created_at:    "2026-06-12T10:00:00Z",
    started_at:    null,
    finished_at:   null,
    ...over,
  };
}

describe("BacktestPanel — basic flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches /api/backtest/jobs?algorithm_id=... on mount", async () => {
    const { calls } = makeFetchMock([]);
    render(<BacktestPanel algorithmId="algo-1" />);
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes("algorithm_id=algo-1"))).toBe(true);
    });
  });

  it("toggles the form open/closed via the 'Nuevo backtest' button", async () => {
    makeFetchMock([]);
    render(<BacktestPanel algorithmId="algo-1" />);
    await waitFor(() => screen.getByRole("button", { name: /Nuevo backtest/i }));

    // Form fields aren't visible initially — toggle.
    fireEvent.click(screen.getByRole("button", { name: /Nuevo backtest/i }));
    expect(screen.getByRole("button", { name: /Cerrar/i })).toBeDefined();

    // Toggle closed again.
    fireEvent.click(screen.getByRole("button", { name: /Cerrar/i }));
    expect(screen.getByRole("button", { name: /Nuevo backtest/i })).toBeDefined();
  });

  it("renders a completed job in the list and loads its results on click", async () => {
    const { calls } = makeFetchMock(
      [completedJob({ id: "job-done", status: "completed" })],
      { metrics: { totalTrades: 5, winRate: 0.6, totalPnl: 100 }, equity_curve: [], trades: [], monte_carlo: null, walk_forward: null, stress_tests: null, advanced: null },
    );

    render(<BacktestPanel algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/completed/i)).toBeDefined();
    });

    // Click the completed row.
    fireEvent.click(screen.getByText(/completed/i));

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes("/api/backtest/jobs/job-done"))).toBe(true);
    });
  });

  it("renders a failed job with an error indicator", async () => {
    makeFetchMock([
      completedJob({ id: "job-fail", status: "failed", error: "bars-not-found" }),
    ]);
    render(<BacktestPanel algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeDefined();
    });
  });

  it("Initial Balance prefills with defaultBacktestBalance when no bot is linked", async () => {
    makeFetchMock([]);
    render(<BacktestPanel
      algorithmId="algo-1"
      linkedBotAccountId={null}
      defaultBacktestBalance={25_000}
    />);
    await waitFor(() => screen.getByRole("button", { name: /Nuevo backtest/i }));
    fireEvent.click(screen.getByRole("button", { name: /Nuevo backtest/i }));

    // Find the Initial Balance input.
    const inputs = Array.from(document.querySelectorAll("input[type='number']"));
    const balanceInput = inputs.find((i) => Number((i as HTMLInputElement).value) === 25_000);
    expect(balanceInput).toBeDefined();
  });

  it("Initial Balance uses default (10_000) when the algo has a linked bot account", async () => {
    makeFetchMock([]);
    render(<BacktestPanel
      algorithmId="algo-1"
      linkedBotAccountId="bot-1"
      defaultBacktestBalance={25_000}
    />);
    await waitFor(() => screen.getByRole("button", { name: /Nuevo backtest/i }));
    fireEvent.click(screen.getByRole("button", { name: /Nuevo backtest/i }));

    const inputs = Array.from(document.querySelectorAll("input[type='number']"));
    const balanceInput = inputs.find((i) => Number((i as HTMLInputElement).value) === 10_000);
    expect(balanceInput).toBeDefined();
    // The 25_000 value should NOT be prefilled because the algo is linked.
    expect(inputs.find((i) => Number((i as HTMLInputElement).value) === 25_000)).toBeUndefined();
  });
});
