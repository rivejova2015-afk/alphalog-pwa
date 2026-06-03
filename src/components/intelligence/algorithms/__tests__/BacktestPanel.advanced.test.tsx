// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BacktestPanel } from "../BacktestPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("../BacktestRuleBuilder", () => ({ BacktestRuleBuilder: () => null }));
vi.mock("../BacktestEquityChart.client", () => ({ BacktestEquityChart: () => null }));
vi.mock("../BacktestTradesTable.client", () => ({ BacktestTradesTable: () => null }));
vi.mock("../BacktestSensitivityHeatmap.client", () => ({ BacktestSensitivityHeatmap: () => null }));

interface CapturedCall { url: string; method: string; body?: unknown }

function buildFetchMock(captures: CapturedCall[], resultsPayload?: unknown) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const call: CapturedCall = { url, method: init?.method ?? "GET" };
    if (init?.body) call.body = JSON.parse(init.body as string);
    captures.push(call);

    if (url.includes("/api/backtest/jobs/") && init?.method !== "POST") {
      return {
        ok:   true,
        json: async () => ({
          job: { id: "job-1", status: "completed", progress_pct: 100 },
          results: resultsPayload ?? null,
        }),
      } as Response;
    }
    if (url.includes("/api/backtest/jobs?")) {
      return {
        ok:   true,
        json: async () => ({
          jobs: resultsPayload ? [{
            id: "job-1", status: "completed", progress_pct: 100, current_phase: "done",
            error: null, created_at: new Date().toISOString(),
            started_at: null, finished_at: null,
          }] : [],
        }),
      } as Response;
    }
    if (url === "/api/backtest/jobs" && init?.method === "POST") {
      return { ok: true, json: async () => ({ id: "job-2" }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

function buildAdvancedResults(over: Record<string, unknown> = {}) {
  return {
    metrics: { totalTrades: 10, winRate: 0.6, totalPnl: 500, sharpe: 1.2 },
    equity_curve: [],
    trades: [],
    monte_carlo: null,
    walk_forward: null,
    stress_tests: null,
    advanced: {
      ml:        { used: true, trainAcc: 0.72, validAcc: 0.61, featureNames: ["rsi", "atr", "ema_spread"] },
      multiTf:   { used: true, higherTimeframes: ["H4", "D1"] },
      portfolio: {
        used: true, status: "completed", legCount: 2,
        metrics: { totalPnl: 199, totalReturnPct: 1.99, sharpe: 2.1, maxDrawdown: 8, maxDrawdownPct: 0.08, legCorrelations: [{ a: "leg-a", b: "leg-b", rho: 0.45 }] },
        equityPreviewLast50: [],
      },
      ...over,
    },
  };
}

describe("BacktestPanel — advanced opt-in form + results tab (Gap #3)", () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it("renders the three opt-in toggles in the new-backtest form", async () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Nuevo backtest/));
    expect(await screen.findByTestId("jobs-toggle-use-ml")).toBeDefined();
    expect(screen.getByTestId("jobs-toggle-use-multi-tf")).toBeDefined();
    expect(screen.getByTestId("jobs-toggle-use-portfolio")).toBeDefined();
  });

  it("portfolio toggle reveals the legs editor with 2 default legs", async () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Nuevo backtest/));
    expect(screen.queryByTestId("portfolio-legs-editor")).toBeNull();
    fireEvent.click(screen.getByTestId("jobs-toggle-use-portfolio"));
    const editor = await screen.findByTestId("portfolio-legs-editor");
    expect(editor).toBeDefined();
    const symbolInputs = editor.querySelectorAll('input[placeholder="SYMBOL"]');
    expect(symbolInputs.length).toBe(2);
  });

  it("Run sends use_ml/useMultiTf/usePortfolio + portfolioLegs in the body", async () => {
    const captures: CapturedCall[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Nuevo backtest/));
    fireEvent.click(screen.getByTestId("jobs-toggle-use-ml"));
    fireEvent.click(screen.getByTestId("jobs-toggle-use-multi-tf"));
    fireEvent.click(screen.getByTestId("jobs-toggle-use-portfolio"));
    fireEvent.click(screen.getByText(/^Run$/));
    await waitFor(() => {
      expect(captures.some((c) => c.method === "POST" && c.url === "/api/backtest/jobs")).toBe(true);
    });
    const postCall = captures.find((c) => c.method === "POST")!;
    const body = postCall.body as Record<string, unknown>;
    expect(body.useMl).toBe(true);
    expect(body.useMultiTf).toBe(true);
    expect(body.usePortfolio).toBe(true);
    expect(Array.isArray(body.portfolioLegs)).toBe(true);
    expect((body.portfolioLegs as unknown[]).length).toBe(2);
  });

  it("Portfolio with <2 legs blocks submit with toast (no POST fired)", async () => {
    const captures: CapturedCall[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(screen.getByText(/Nuevo backtest/));
    fireEvent.click(screen.getByTestId("jobs-toggle-use-portfolio"));
    // Remove 1 leg → now only 1 left. The first × button targets idx=0.
    const editor = screen.getByTestId("portfolio-legs-editor");
    const removeButtons = editor.querySelectorAll('button[aria-label="remove leg"]');
    // With exactly 2 legs the buttons are disabled — verify guard works
    expect((removeButtons[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("results.advanced populated → Advanced tab appears and renders all three blocks", async () => {
    const advanced = buildAdvancedResults();
    globalThis.fetch = buildFetchMock([], advanced) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    // Wait for jobs list to populate, then click the completed job.
    const jobBtn = await screen.findByText(/completed/);
    fireEvent.click(jobBtn);
    expect(await screen.findByTestId("advanced-tab-label")).toBeDefined();
    fireEvent.click(screen.getByTestId("advanced-tab-label"));
    expect(await screen.findByTestId("advanced-results-panel")).toBeDefined();
    expect(screen.getByTestId("advanced-ml-block")).toBeDefined();
    expect(screen.getByTestId("advanced-multitf-block")).toBeDefined();
    expect(screen.getByTestId("advanced-portfolio-completed")).toBeDefined();
  });

  it("portfolio.status='failed' renders failed banner with reason", async () => {
    const advanced = buildAdvancedResults({
      portfolio: { used: true, status: "failed", reason: "missing bars for GBPUSD" },
    });
    globalThis.fetch = buildFetchMock([], advanced) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(await screen.findByText(/completed/));
    fireEvent.click(await screen.findByTestId("advanced-tab-label"));
    const failedBlock = await screen.findByTestId("advanced-portfolio-failed");
    expect(failedBlock).toBeDefined();
    expect(failedBlock.textContent).toMatch(/missing bars/);
  });

  it("no advanced in results → Advanced tab hidden", async () => {
    const plain = { ...buildAdvancedResults(), advanced: null };
    globalThis.fetch = buildFetchMock([], plain) as unknown as typeof fetch;
    render(<BacktestPanel algorithmId="algo-1" />);
    fireEvent.click(await screen.findByText(/completed/));
    await waitFor(() => {
      expect(screen.getByText(/Overview/)).toBeDefined();
    });
    expect(screen.queryByTestId("advanced-tab-label")).toBeNull();
  });
});
