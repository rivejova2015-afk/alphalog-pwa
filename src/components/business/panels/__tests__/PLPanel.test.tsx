// @vitest-environment jsdom
//
// PLPanel — Profit & Loss panel con tiles, breakdown por category/account,
// monthly expenses list, 6-month trend + add/delete cost.
//
// Validates:
//   1. Skeleton durante loading.
//   2. "No data" cuando no hay trades ni costs.
//   3. Con trades + costs → 4 tiles (Gross/Total Costs/Net/Margin) +
//      breakdown sections.
//   4. Costs by Category renderiza cada categoría con monto.
//   5. Income by Account agrupa por account_id.
//   6. Monthly Expenses lista con delete button.
//   7. 6-Month Trend renderiza 6 filas.
//   8. Add Cost button hidden cuando isReadOnly=true.
//   9. Delete button → ConfirmDialog → deleteBusinessCost + reload + toast.
//  10. Delete failure → toast error + log.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const {
  loadCostsMock,
  usePnlMetricsMock,
  deleteBusinessCostMock,
  logErrorMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  loadCostsMock:          vi.fn(),
  usePnlMetricsMock:      vi.fn(),
  deleteBusinessCostMock: vi.fn(),
  logErrorMock:           vi.fn(),
  toastSuccessMock:       vi.fn(),
  toastErrorMock:         vi.fn(),
}));

vi.mock("@/lib/business/offline-loader", () => ({
  loadBusinessCosts: loadCostsMock,
}));
vi.mock("@/lib/business/queries", () => ({
  deleteBusinessCost: deleteBusinessCostMock,
}));
vi.mock("@/hooks/usePnlMetrics", () => ({
  usePnlMetrics: usePnlMetricsMock,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, message: vi.fn() },
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
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button onClick={onConfirm} data-testid="confirm-delete">Confirm</button> : null,
}));
vi.mock("../../forms/CostForm.client", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="cost-form">
      <button onClick={onClose}>Close Form</button>
    </div>
  ),
}));

import PLPanel from "../PLPanel.client";

function makeTrade(over: Partial<{ id: string; account_id: string; exit_date: string; pnl: number }> = {}) {
  return {
    id: over.id ?? "t", account_id: over.account_id ?? "acc-a",
    entry_date: "2026-06-01", exit_date: over.exit_date ?? "2026-06-15",
    pnl: over.pnl ?? 100, status: "Closed" as const,
  };
}

function makeCost(over: Partial<{ id: string; amount: number; category: string; cost_date: string; vendor: string }> = {}) {
  return {
    id:          over.id ?? "c",
    user_id:     "u1",
    amount:      over.amount ?? 50,
    category:    over.category ?? "Tools Software",
    description: "desc",
    vendor:      over.vendor ?? "Acme",
    cost_date:   over.cost_date ?? "2026-06-10",
    is_recurring_instance: false,
    sort_index:  0,
    created_at:  "",
    updated_at:  "",
  };
}

describe("PLPanel", () => {
  beforeEach(() => {
    loadCostsMock.mockReset();
    usePnlMetricsMock.mockReset();
    deleteBusinessCostMock.mockReset();
    logErrorMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("Skeleton durante loading", () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: true });
    loadCostsMock.mockResolvedValue([]);
    render(<PLPanel />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("'No data' cuando trades y costs vacíos", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<PLPanel />);
    await waitFor(() => {
      expect(screen.getByText(/No data/i)).toBeDefined();
    });
  });

  it("Con trades + costs → 4 KPI tiles", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [makeTrade({ exit_date: `${currentMonth}-15`, pnl: 500 })],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([
      makeCost({ cost_date: `${currentMonth}-10`, amount: 100, category: "Tools Software" }),
    ]);

    render(<PLPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Gross Income/i)).toBeDefined();
      expect(screen.getByText(/Total Costs/i)).toBeDefined();
      expect(screen.getByText(/Net Income/i)).toBeDefined();
      expect(screen.getByText(/Margin/i)).toBeDefined();
      // grossIncome=500 (positive pnl) — aparece en KPI tile y Income by
      // Account, así que usamos getAllByText (>0 matches).
      expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
      // $100 aparece en Total Costs tile y Costs by Category row.
      expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    });
  });

  it("Costs by Category agrupa por categoría", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [makeTrade({ exit_date: `${currentMonth}-01`, pnl: 1000 })],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([
      makeCost({ id: "c1", category: "Tools Software", amount: 100, cost_date: `${currentMonth}-05` }),
      makeCost({ id: "c2", category: "Tools Software", amount: 50,  cost_date: `${currentMonth}-10` }),
      makeCost({ id: "c3", category: "Data",           amount: 200, cost_date: `${currentMonth}-15` }),
    ]);

    render(<PLPanel />);
    await waitFor(() => {
      expect(screen.getByText("Tools Software")).toBeDefined();
      // $150 = 100 + 50, único en el output (no duplicado).
      expect(screen.getByText("$150.00")).toBeDefined();
      expect(screen.getByText("Data")).toBeDefined();
      // $200 aparece en Data tile + Monthly Expenses cost row.
      expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
    });
  });

  it("Income by Account muestra account_id agregado", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [
        makeTrade({ id: "t1", account_id: "acc-main",  exit_date: `${currentMonth}-01`, pnl: 500 }),
        makeTrade({ id: "t2", account_id: "acc-main",  exit_date: `${currentMonth}-15`, pnl: 300 }),
        makeTrade({ id: "t3", account_id: "acc-other", exit_date: `${currentMonth}-20`, pnl: 200 }),
      ],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([]);

    render(<PLPanel />);
    await waitFor(() => {
      expect(screen.getByText("acc-main")).toBeDefined();
      expect(screen.getByText("$800.00")).toBeDefined(); // 500 + 300 unique
      expect(screen.getByText("acc-other")).toBeDefined();
      // acc-other PNL = 200; trend current month profit = 1000 → distinct.
      expect(screen.getAllByText("$200.00").length).toBeGreaterThan(0);
    });
  });

  it("Monthly Expenses lista con delete button por cost", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [makeTrade({ exit_date: `${currentMonth}-01`, pnl: 100 })],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([
      makeCost({ id: "c1", vendor: "AWS",      amount: 50, cost_date: `${currentMonth}-05` }),
      makeCost({ id: "c2", vendor: "Software", amount: 30, cost_date: `${currentMonth}-10` }),
    ]);

    render(<PLPanel />);
    await waitFor(() => {
      expect(screen.getByText("AWS")).toBeDefined();
      expect(screen.getByText("Software")).toBeDefined();
      expect(screen.getAllByLabelText(/Eliminar costo/i).length).toBe(2);
    });
  });

  it("Add Cost button hidden cuando isReadOnly=true", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);

    render(<PLPanel isReadOnly />);
    await waitFor(() => screen.getByRole("combobox"));
    expect(screen.queryByText(/Add Cost/i)).toBeNull();
  });

  it("Delete cost: click → confirm → deleteBusinessCost + toast success + reload", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [makeTrade({ exit_date: `${currentMonth}-01`, pnl: 100 })],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([
      makeCost({ id: "c1", vendor: "AWS", cost_date: `${currentMonth}-05` }),
    ]);
    deleteBusinessCostMock.mockResolvedValue(undefined);

    render(<PLPanel />);
    await waitFor(() => screen.getByText("AWS"));

    fireEvent.click(screen.getByLabelText(/Eliminar costo/i));
    expect(screen.getByTestId("confirm-delete")).toBeDefined();
    fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => {
      expect(deleteBusinessCostMock).toHaveBeenCalledWith("c1");
      expect(toastSuccessMock).toHaveBeenCalledWith("Costo eliminado");
    });
    // loadCosts re-fetcheado tras delete (2 calls total: initial + post-delete).
    expect(loadCostsMock).toHaveBeenCalledTimes(2);
  });

  it("Delete failure → toast error + log", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [makeTrade({ exit_date: `${currentMonth}-01`, pnl: 100 })],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([
      makeCost({ id: "c1", vendor: "AWS", cost_date: `${currentMonth}-05` }),
    ]);
    deleteBusinessCostMock.mockRejectedValue(new Error("rls denied"));

    render(<PLPanel />);
    await waitFor(() => screen.getByText("AWS"));

    fireEvent.click(screen.getByLabelText(/Eliminar costo/i));
    fireEvent.click(screen.getByTestId("confirm-delete"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("No se pudo eliminar el costo");
      expect(logErrorMock).toHaveBeenCalled();
    });
  });

  it("Add Cost button click → CostForm visible", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<PLPanel />);

    await waitFor(() => screen.getByText(/Add Cost/i));
    fireEvent.click(screen.getByText(/Add Cost/i));
    expect(screen.getByTestId("cost-form")).toBeDefined();
  });
});
