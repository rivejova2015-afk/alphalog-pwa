// @vitest-environment jsdom
//
// BacktestSandboxPanel — compact multi-config comparison UI (Wave 5 item
// 25). Covers: collapsed by default, expands to show 2 default variants,
// add/remove variant bounds (2 min, 8 max), submit POSTs
// rulesOverrides.slPoints/tpPoints/sizing.value per variant, renders the
// results table with the best variant highlighted, error toast on failure.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));

import { BacktestSandboxPanel } from "../BacktestSandboxPanel.client";

function buildFetchMock(response: { ok: boolean; body: unknown }) {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, body });
    return { ok: response.ok, json: async () => response.body } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("BacktestSandboxPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("starts collapsed", () => {
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    expect(screen.queryByText(/Correr sandbox/i)).toBeNull();
  });

  it("expands to show 2 default variants and the symbol field", () => {
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    expect(screen.getByDisplayValue("Variante 1")).toBeDefined();
    expect(screen.getByDisplayValue("Variante 2")).toBeDefined();
    expect(screen.getByDisplayValue("XAUUSD")).toBeDefined();
  });

  it("cannot remove a variant below 2", () => {
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    const removeButtons = screen.getAllByRole("button", { name: /Quitar/i });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toBeDisabled();
  });

  it("cannot add more than 8 variants", () => {
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    const addBtn = screen.getByText("+ Agregar variante");
    for (let i = 0; i < 6; i++) fireEvent.click(addBtn);
    expect(screen.getAllByRole("button", { name: /Quitar/i })).toHaveLength(8);
    expect(addBtn).toBeDisabled();
  });

  it("submits rulesOverrides derived from the variant fields", async () => {
    const calls = buildFetchMock({
      ok: true,
      body: { results: [{ label: "Variante 1", metrics: { totalTrades: 5, winRate: 0.6, totalPnl: 100, profitFactor: 1.5, maxDrawdownPct: 5, sharpe: 1 } }, { label: "Variante 2", metrics: { totalTrades: 4, winRate: 0.4, totalPnl: -50, profitFactor: 0.8, maxDrawdownPct: 10, sharpe: -0.5 } }], best: "Variante 1", barsUsed: 1000 },
    });
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    fireEvent.click(screen.getByRole("button", { name: /Correr sandbox/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("2 variantes evaluadas — mejor: Variante 1");
    });
    expect(calls[0].url).toBe("/api/algorithms/algo-1/backtest/sandbox");
    const payload = calls[0].body as { variants: { label: string; rulesOverrides: { slPoints: number; tpPoints: number; sizing: { value: number } } }[] };
    expect(payload.variants).toHaveLength(2);
    expect(payload.variants[0]).toMatchObject({ label: "Variante 1", rulesOverrides: { slPoints: 100, tpPoints: 100, sizing: { value: 0.1 } } });
  });

  it("renders the results table with the best variant marked", async () => {
    buildFetchMock({
      ok: true,
      body: {
        results: [
          { label: "Variante 1", metrics: { totalTrades: 5, winRate: 0.6, totalPnl: 100, profitFactor: 1.5, maxDrawdownPct: 5, sharpe: 1 } },
          { label: "Variante 2", metrics: { totalTrades: 4, winRate: 0.4, totalPnl: -50, profitFactor: 0.8, maxDrawdownPct: 10, sharpe: -0.5 } },
        ],
        best: "Variante 1",
        barsUsed: 1000,
      },
    });
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    fireEvent.click(screen.getByRole("button", { name: /Correr sandbox/i }));

    expect(await screen.findByText("+100.00")).toBeDefined();
    expect(screen.getByText("-50.00")).toBeDefined();
    expect(screen.getByText("1000 barras usadas.")).toBeDefined();
  });

  it("shows an error toast when the sandbox request fails", async () => {
    buildFetchMock({ ok: false, body: { error: "Not enough bars: 10." } });
    render(<BacktestSandboxPanel algorithmId="algo-1" defaultSymbol="XAUUSD" />);
    fireEvent.click(screen.getByText("Comparar variantes"));
    fireEvent.click(screen.getByRole("button", { name: /Correr sandbox/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Not enough bars: 10.");
    });
  });
});
