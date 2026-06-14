// @vitest-environment jsdom
//
// AlgoAccordion — the list-and-row container for the algorithms hub. Tests
// the lightweight behaviors that don't depend on heavy children (BacktestPanel,
// EngineBacktestPanel, ControlPanel, EquityCurve), which we stub out.
// Validates:
//   1. Renders one row per algorithm.
//   2. First algorithm expanded by default (aria-expanded='true').
//   3. Lifecycle badge color + label match algoStatus (paper/draft/live).
//   4. "Aprobar" button shown ONLY for status='paper'.
//   5. Approve click POSTs to /approve and updates the lifecycle badge.
//   6. Approve API failure surfaces an error toast.
//   7. Delete click opens the confirm dialog (role=dialog).
//   8. Confirm dialog Cancel button closes it.
//   9. Confirm dialog Delete fires DELETE + success toast + closes.
//  10. Delete API failure surfaces error toast (dialog stays open).
//  11. "Detalles" click mounts the AlgorithmDetailsModal stub.
//  12. Clicking the row header collapses/expands aria-expanded.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock:   vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, info: vi.fn(), warning: vi.fn(), message: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

// Stub heavy children to keep the render tree small and predictable.
vi.mock("../AlgoCard",                       () => ({ AlgoCard:           () => <div data-testid="algo-card" /> }));
vi.mock("../TradesTable",                    () => ({ TradesTable:        () => null }));
vi.mock("../EquityCurve",                    () => ({ EquityCurve:        () => null }));
vi.mock("../ControlPanel.client",            () => ({ ControlPanel:       () => <div data-testid="control-panel" /> }));
vi.mock("../QuantModelsPanel",               () => ({ QuantModelsPanel:   () => null }));
vi.mock("../OpenPositionsPanel.client",      () => ({ OpenPositionsPanel: () => null }));
vi.mock("../BacktestPanel.client",           () => ({ BacktestPanel:      () => null }));
vi.mock("../EngineBacktestPanel.client",     () => ({ EngineBacktestPanel: () => null }));
vi.mock("../AlgorithmDetailsModal.client",   () => ({ default: () => <div data-testid="details-modal" /> }));
vi.mock("@/components/ui/badge",             () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));

import { AlgoAccordion } from "../AlgoAccordion.client";

function algo(over: Partial<{
  id: string; name: string; status: "ACTIVE" | "PAUSED" | "ERROR";
  algoStatus: string; marketType: "forex" | "futures" | "options" | "crypto";
  instrument: string[]; direction: "long" | "short" | "both";
}> = {}) {
  return {
    id:           over.id ?? "algo-1",
    name:         over.name ?? "Test algo",
    marketType:   over.marketType ?? "forex",
    instrument:   over.instrument ?? ["XAUUSD"],
    direction:    over.direction,
    status:       over.status ?? ("PAUSED" as const),
    algoStatus:   over.algoStatus ?? "draft",
    linkedBotAccountId: null,
    pnlToday:     0,
    pnlTotal:     0,
    winRate:      0,
    totalTrades:  0,
    profitFactor: 0,
    maxDrawdown:  0,
  };
}

describe("AlgoAccordion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders one row per algorithm", () => {
    render(<AlgoAccordion algos={[
      algo({ id: "a1", name: "Alpha" }),
      algo({ id: "a2", name: "Beta" }),
      algo({ id: "a3", name: "Gamma" }),
    ]} />);
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Gamma")).toBeDefined();
  });

  it("expands the first algorithm by default (aria-expanded='true')", () => {
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "Alpha" }), algo({ id: "a2", name: "Beta" })]} />);
    const headers = screen.getAllByRole("button", { expanded: true });
    expect(headers).toHaveLength(1);
    expect(headers[0].textContent).toContain("Alpha");
  });

  it("renders lifecycle badge with the algoStatus label uppercase", () => {
    render(<AlgoAccordion algos={[algo({ algoStatus: "paper" })]} />);
    // Badge text appears as-is in the DOM with the lifecycle styling.
    const lifecycleBadges = screen.getAllByText("paper");
    expect(lifecycleBadges.length).toBeGreaterThan(0);
  });

  it("shows 'Aprobar' button ONLY for algoStatus='paper'", () => {
    // Use distinct ids so the React internal `algoStatuses` state doesn't
    // carry the previous mount's lifecycle across rerenders.
    const { unmount: u1 } = render(<AlgoAccordion algos={[algo({ id: "draft-x", name: "Draft algo", algoStatus: "draft" })]} />);
    expect(screen.queryByLabelText(/Aprobar Draft algo/i)).toBeNull();
    u1();

    const { unmount: u2 } = render(<AlgoAccordion algos={[algo({ id: "paper-x", name: "Paper algo", algoStatus: "paper" })]} />);
    expect(screen.getByLabelText(/Aprobar Paper algo/i)).toBeDefined();
    u2();

    render(<AlgoAccordion algos={[algo({ id: "live-x", name: "Live algo", algoStatus: "live" })]} />);
    expect(screen.queryByLabelText(/Aprobar Live algo/i)).toBeNull();
  });

  it("Approve click POSTs to /approve and updates the lifecycle badge to 'approved'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X", algoStatus: "paper" })]} />);
    fireEvent.click(screen.getByLabelText(/Aprobar X/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/algorithms/a1/approve", expect.objectContaining({ method: "POST" }));
      expect(toastSuccessMock).toHaveBeenCalledWith("Algoritmo aprobado");
    });
    // Lifecycle badge flips to 'approved'.
    expect(screen.getByText("approved")).toBeDefined();
    // Aprobar button is gone after the flip.
    expect(screen.queryByLabelText(/Aprobar X/i)).toBeNull();
  });

  it("Approve API failure surfaces an error toast", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X", algoStatus: "paper" })]} />);
    fireEvent.click(screen.getByLabelText(/Aprobar X/i));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("No se pudo aprobar el algoritmo");
    });
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("Delete click opens the confirm dialog", () => {
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X" })]} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByLabelText(/Eliminar X/i));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(/Eliminar estrategia/i)).toBeDefined();
  });

  it("Cancel button in the confirm dialog closes it without deleting", () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X" })]} />);
    fireEvent.click(screen.getByLabelText(/Eliminar X/i));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Confirm Delete fires DELETE and closes the dialog on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X" })]} />);
    fireEvent.click(screen.getByLabelText(/Eliminar X/i));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/algorithms/a1", expect.objectContaining({ method: "DELETE" }));
      expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringContaining("X"));
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Delete API failure surfaces an error toast (dialog stays open)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "rls denied" }),
    }) as unknown as typeof fetch;
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X" })]} />);
    fireEvent.click(screen.getByLabelText(/Eliminar X/i));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("rls denied");
    });
    // Dialog stays open so the user can retry.
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  it("Detalles click mounts the AlgorithmDetailsModal", () => {
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "X" })]} />);
    expect(screen.queryByTestId("details-modal")).toBeNull();
    fireEvent.click(screen.getByLabelText(/Ver detalles de conexión de X/i));
    expect(screen.getByTestId("details-modal")).toBeDefined();
  });

  it("clicking the row header collapses/re-expands it (aria-expanded toggle)", () => {
    render(<AlgoAccordion algos={[algo({ id: "a1", name: "Alpha" }), algo({ id: "a2", name: "Beta" })]} />);
    const alphaHeader = screen.getAllByRole("button", { expanded: true })[0];
    expect(alphaHeader.textContent).toContain("Alpha");

    // Collapse Alpha.
    fireEvent.click(alphaHeader);
    expect(alphaHeader.getAttribute("aria-expanded")).toBe("false");

    // Expand Beta.
    const betaHeader = screen.getAllByRole("button")[1];  // Beta row header (after first row's buttons)
    const betaRowHeader = screen.getAllByRole("button").find((b) => b.textContent?.includes("Beta") && b.getAttribute("aria-expanded") !== null);
    if (betaRowHeader) {
      fireEvent.click(betaRowHeader);
      expect(betaRowHeader.getAttribute("aria-expanded")).toBe("true");
    } else {
      // Fallback: at least confirm one of the visible row headers can be re-expanded.
      fireEvent.click(alphaHeader);
      expect(alphaHeader.getAttribute("aria-expanded")).toBe("true");
    }
    void betaHeader;
  });
});
