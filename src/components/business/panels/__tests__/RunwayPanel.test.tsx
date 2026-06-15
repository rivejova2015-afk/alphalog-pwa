// @vitest-environment jsdom
//
// RunwayPanel — last-3-months burn rate + cash reserve input → runwayMonths
// con color tiers (red <= 0, yellow <= 3, green > 3).
//
// Validates:
//   1. Skeleton durante loading.
//   2. Cash reserve input visible siempre cuando !loading.
//   3. Cash reserve clamped a 0 (no negativos).
//   4. Sin runwayMetrics (sin trades/costs) → tiles ocultos.
//   5. Con costs y cash reserve → 4 KPI tiles renderizan.
//   6. Status alert: 'Healthy Runway' cuando > 3, 'Limited' cuando 0-3,
//      'Critical' cuando <= 0.
//   7. Runway tier coloring (Months tile shows 'Critical' o 'X.Xm').
//   8. loadCosts throw → logError pero UI continúa.

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

import RunwayPanel from "../RunwayPanel.client";

function makeCost(over: Partial<{ amount: number; cost_date: string; category: string }> = {}) {
  return {
    id:          `c-${Math.random()}`,
    user_id:     "u1",
    amount:      over.amount ?? 100,
    category:    over.category ?? "Tools Software",
    description: "x", vendor: "y",
    cost_date:   over.cost_date ?? "2026-06-10",
    is_recurring_instance: false,
    sort_index:  0, created_at: "", updated_at: "",
  };
}

describe("RunwayPanel", () => {
  beforeEach(() => {
    loadCostsMock.mockReset();
    usePnlMetricsMock.mockReset();
    logErrorMock.mockReset();
  });

  it("Skeleton durante loading", () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: true });
    loadCostsMock.mockResolvedValue([]);
    render(<RunwayPanel />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("Cash reserve input visible cuando !loading", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<RunwayPanel />);
    await waitFor(() => screen.getByText(/Estimated Cash Reserve/i));
    expect(screen.getByRole("spinbutton")).toBeDefined();
  });

  it("Cash reserve clamped a 0 (no negativos)", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<RunwayPanel />);

    await waitFor(() => screen.getByRole("spinbutton"));
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "-500" } });
    expect(input.value).toBe("0");
  });

  it("Sin trades ni costs → tiles ocultos (solo input)", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<RunwayPanel />);

    await waitFor(() => screen.getByRole("spinbutton"));
    expect(screen.queryByText(/Avg Monthly Profit/i)).toBeNull();
    expect(screen.queryByText(/Months Runway/i)).toBeNull();
  });

  it("Con costs → 4 KPI tiles renderizan", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([
      makeCost({ amount: 500, cost_date: `${currentMonth}-01` }),
      makeCost({ amount: 300, cost_date: `${currentMonth}-15` }),
    ]);

    render(<RunwayPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Avg Monthly Profit/i)).toBeDefined();
      expect(screen.getByText(/Avg Monthly Burn/i)).toBeDefined();
      // 'Cash Reserve' matches the input label AND the tile → getAllByText.
      expect(screen.getAllByText(/Cash Reserve/i).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/Months Runway/i)).toBeDefined();
    });
  });

  it("Status 'Critical: No Runway' cuando runwayMonths <= 0 (cash=0, burn>0)", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([makeCost({ amount: 1000, cost_date: `${currentMonth}-01` })]);

    render(<RunwayPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Critical: No Runway/i)).toBeDefined();
      expect(screen.getByText(/cash reserve is depleted/i)).toBeDefined();
    });
  });

  it("Status 'Warning: Limited Runway' cuando 0 < runway <= 3", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // avgBurn = 1000 / 3 ≈ 333.33 (last 3 months). cash 500 → runway 1.5 → Warning.
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([makeCost({ amount: 1000, cost_date: `${currentMonth}-01` })]);

    render(<RunwayPanel />);
    await waitFor(() => screen.getByRole("spinbutton"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "500" } });

    await waitFor(() => {
      expect(screen.getByText(/Warning: Limited Runway/i)).toBeDefined();
      expect(screen.getByText(/less than 3 months/i)).toBeDefined();
    });
  });

  it("Status 'Healthy Runway' cuando runway > 3", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // avgBurn = 300/3 = 100. cash 5000 → runway 50 → Healthy.
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([makeCost({ amount: 300, cost_date: `${currentMonth}-01` })]);

    render(<RunwayPanel />);
    await waitFor(() => screen.getByRole("spinbutton"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5000" } });

    await waitFor(() => {
      expect(screen.getByText(/Healthy Runway/i)).toBeDefined();
      expect(screen.getByText(/months of runway based on current burn rate/i)).toBeDefined();
    });
  });

  it("'How It Works' explanation visible cuando hay metrics", async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([makeCost({ amount: 100, cost_date: `${currentMonth}-01` })]);

    render(<RunwayPanel />);
    await waitFor(() => {
      expect(screen.getByText(/How It Works/i)).toBeDefined();
      expect(screen.getByText(/Cash Reserve ÷/i)).toBeDefined();
    });
  });

  it("loadCosts throw → logError + UI continúa con input visible", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockRejectedValue(new Error("supabase ECONNREFUSED"));

    render(<RunwayPanel />);

    await waitFor(() => {
      expect(logErrorMock).toHaveBeenCalledWith(
        "RunwayPanel",
        expect.objectContaining({ error: expect.stringMatching(/ECONNREFUSED/) }),
      );
    });
    expect(screen.getByText(/Runway Analysis/i)).toBeDefined();
    expect(screen.getByRole("spinbutton")).toBeDefined();
  });
});
