// @vitest-environment jsdom
//
// KPIPanel — combina trades + costs y muestra cost/trade, consistency,
// profit/hour, per-account breakdown. Tests focus en visible behavior.
//
// Validates:
//   1. Skeleton durante loading.
//   2. Month selector renderiza 12 opciones (getLastNMonths(12)).
//   3. Cuando no hay trades ni costs (empty) → no muestra kpiMetrics cards.
//   4. Con trades en current month → tiles + accountMetrics tabla.
//   5. Per-Account "No account data for this month" cuando metrics existen
//      pero no hay trades del mes seleccionado.
//   6. loadCosts throws → logError + no rompe la UI.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { loadCostsMock, usePnlMetricsMock, logErrorMock } = vi.hoisted(() => ({
  loadCostsMock:     vi.fn(),
  usePnlMetricsMock: vi.fn(),
  logErrorMock:      vi.fn(),
}));

vi.mock("@/lib/business/offline-loader", () => ({
  loadBusinessCosts: loadCostsMock,
}));
vi.mock("@/hooks/usePnlMetrics", () => ({
  usePnlMetrics: usePnlMetricsMock,
}));
vi.mock("@/lib/log", () => ({
  logError: logErrorMock, logInfo: vi.fn(), logWarn: vi.fn(),
}));
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
vi.mock("@/components/ui", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import KPIPanel from "../KPIPanel.client";

describe("KPIPanel", () => {
  beforeEach(() => {
    loadCostsMock.mockReset();
    usePnlMetricsMock.mockReset();
    logErrorMock.mockReset();
  });

  it("renders skeleton durante loading", () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: true });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("Month selector con 12 opciones (getLastNMonths(12))", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);

    await waitFor(() => screen.getByRole("combobox"));
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.querySelectorAll("option").length).toBe(12);
  });

  it("Empty: sin trades ni costs → NO renderiza KPI tiles", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);

    await waitFor(() => screen.getByRole("combobox"));
    expect(screen.queryByText(/Cost Per Trade/i)).toBeNull();
    expect(screen.queryByText(/Consistency/i)).toBeNull();
    expect(screen.queryByText(/Per-Account Metrics/i)).toBeNull();
  });

  it("Con trades en current month → renderiza KPI tiles + Per-Account tabla", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [
        { id: "t1", account_id: "acc-main", entry_date: `${currentMonth}-01`,
          exit_date: `${currentMonth}-15`, pnl: 500, status: "Closed" },
        { id: "t2", account_id: "acc-main", entry_date: `${currentMonth}-02`,
          exit_date: `${currentMonth}-20`, pnl: 300, status: "Closed" },
      ],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Cost Per Trade/i)).toBeDefined();
      expect(screen.getByText(/Consistency/i)).toBeDefined();
      expect(screen.getByText(/Profit Per Hour/i)).toBeDefined();
      expect(screen.getByText(/Per-Account Metrics/i)).toBeDefined();
      expect(screen.getByText("acc-main")).toBeDefined();
    });
  });

  it("Cuando month seleccionado no tiene trades → 'No account data for this month'", async () => {
    // Trades existen pero en mes distinto al actualmente seleccionado en el
    // dropdown. KPIPanel renderiza el message vacío.
    usePnlMetricsMock.mockReturnValue({
      trades: [{
        id: "t1", account_id: "acc-x", entry_date: "2020-01-01",
        exit_date: "2020-01-15", pnl: 100, status: "Closed",
      }],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);

    await waitFor(() => screen.getByRole("combobox"));
    // Default month (current) tiene 0 trades del 2020. Verify mensaje.
    await waitFor(() => {
      expect(screen.getByText(/No account data for this month/i)).toBeDefined();
    });
  });

  it("Month selector cambio re-calcula kpiMetrics", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [{
        id: "t1", account_id: "acc-main", entry_date: `${currentMonth}-01`,
        exit_date: `${currentMonth}-15`, pnl: 500, status: "Closed",
      }],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([]);
    render(<KPIPanel />);

    // Initial: current month muestra account row
    await waitFor(() => screen.getByText("acc-main"));

    // Cambiar a otro mes (first option en el dropdown = más antiguo)
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const oldMonth = select.querySelectorAll("option")[0].value;
    fireEvent.change(select, { target: { value: oldMonth } });

    // Después del cambio, el account no debería aparecer (no trades en old month).
    await waitFor(() => {
      expect(screen.getByText(/No account data for this month/i)).toBeDefined();
    });
  });

  it("loadCosts throw → logError pero UI continúa con month selector", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockRejectedValue(new Error("network ECONNREFUSED"));

    render(<KPIPanel />);

    await waitFor(() => {
      expect(logErrorMock).toHaveBeenCalledWith(
        "KPIPanel",
        expect.objectContaining({ error: expect.stringMatching(/ECONNREFUSED/) }),
      );
    });
    // UI still rendered header + month selector.
    expect(screen.getByText(/Key Performance Indicators/i)).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
  });
});
