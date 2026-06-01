// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("../EquityCurve", () => ({ EquityCurve: () => null }));
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

function buildFetchMock(captures: { url: string; body: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.body) {
      captures.push({ url, body: JSON.parse(init.body as string) });
    }
    if (url.includes("/history")) {
      return { ok: true, json: async () => ({ runs: [] }) } as Response;
    }
    if (url.includes("/symbol-status")) {
      return { ok: true, json: async () => ({}) } as Response;
    }
    if (url.includes("/engine-backtest")) {
      return {
        ok:   true,
        json: async () => ({
          algorithm: { id: "algo-1", name: "Test", status: "draft" },
          symbol:    "XAUUSD",
          from:      "2026-01-01T00:00:00Z",
          to:        "2026-03-01T00:00:00Z",
          bars_loaded: [{ tf: "M15", count: 1000 }],
          result: {
            metrics:      { totalTrades: 0 },
            equityCurve:  [],
            finalBalance: 10000,
            durationMs:   42,
            trades:       [],
          },
          monte_carlo:       null,
          walk_forward:      null,
          advanced:          { ml: { used: true, trainAcc: 0.6, validAcc: 0.55, featureNames: ["a", "b"] }, multiTf: null, portfolio: null },
          advanced_warnings: [],
          gates:             null,
          promoted:          false,
          run_id:            "run-xyz",
          created_at:        new Date().toISOString(),
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("EngineBacktestPanel — advanced toggles (Gap #1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the three opt-in toggles", () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    expect(screen.getByTestId("toggle-use-ml")).toBeDefined();
    expect(screen.getByTestId("toggle-use-multi-tf")).toBeDefined();
    expect(screen.getByTestId("toggle-use-portfolio")).toBeDefined();
  });

  it("sends use_ml/use_multi_tf/use_portfolio=false by default in the run body", async () => {
    const captures: { url: string; body: unknown }[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(captures.some((c) => c.url.endsWith("/engine-backtest"))).toBe(true);
    });
    const runCall = captures.find((c) => c.url.endsWith("/engine-backtest"))!;
    const body = runCall.body as Record<string, unknown>;
    expect(body.use_ml).toBe(false);
    expect(body.use_multi_tf).toBe(false);
    expect(body.use_portfolio).toBe(false);
  });

  it("propagates each flag when its toggle is checked", async () => {
    const captures: { url: string; body: unknown }[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByTestId("toggle-use-ml"));
    fireEvent.click(screen.getByTestId("toggle-use-multi-tf"));
    fireEvent.click(screen.getByTestId("toggle-use-portfolio"));
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(captures.some((c) => c.url.endsWith("/engine-backtest"))).toBe(true);
    });
    const runCall = captures.find((c) => c.url.endsWith("/engine-backtest"))!;
    const body = runCall.body as Record<string, unknown>;
    expect(body.use_ml).toBe(true);
    expect(body.use_multi_tf).toBe(true);
    expect(body.use_portfolio).toBe(true);
  });

  it("renders the advanced results card when response.advanced is populated", async () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByTestId("toggle-use-ml"));
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(screen.queryByTestId("advanced-results")).not.toBeNull();
    });
    expect(screen.getByText(/ML Signal/)).toBeDefined();
  });
});
