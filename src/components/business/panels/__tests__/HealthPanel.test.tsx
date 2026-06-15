// @vitest-environment jsdom
//
// HealthPanel — combina last-3-months PL + alerts del módulo metrics.
// Tests focus en visible UI cuando loading/empty/with-alerts.
//
// Validates:
//   1. Loading skeleton mientras costsLoading o tradesLoading true.
//   2. "All Systems Normal" cuando no hay alerts.
//   3. Alert rows con severity icon + título + message.
//   4. Health Check Summary footer estático siempre presente.
//   5. Cost load error capturado via logError (silent UI).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

import HealthPanel from "../HealthPanel.client";

describe("HealthPanel", () => {
  beforeEach(() => {
    loadCostsMock.mockReset();
    usePnlMetricsMock.mockReset();
    logErrorMock.mockReset();
  });

  it("renders skeleton mientras tradesLoading=true", () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: true });
    loadCostsMock.mockResolvedValue([]);
    render(<HealthPanel />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("renders 'All Systems Normal' cuando no hay alerts (trades vacíos + costs vacíos)", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);
    render(<HealthPanel />);

    await waitFor(() => {
      expect(screen.getByText(/All Systems Normal/i)).toBeDefined();
    });
    expect(screen.getByText(/No critical alerts detected/i)).toBeDefined();
  });

  it("renders alert con título cuando hay negative month en últimos 3", async () => {
    // Construct a trade that creates a Negative Month alert: pnl=-500 in
    // current month (covered by getLastNMonths(3)).
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    usePnlMetricsMock.mockReturnValue({
      trades: [{
        id: "t1", account_id: "a1", entry_date: `${currentMonth}-01`,
        exit_date: `${currentMonth}-15`, pnl: -500, status: "Closed",
      }],
      loading: false,
    });
    loadCostsMock.mockResolvedValue([]);

    render(<HealthPanel />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`Negative Month: ${currentMonth}`))).toBeDefined();
    });
  });

  it("Health Check Summary footer estático siempre visible", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockResolvedValue([]);

    render(<HealthPanel />);
    await waitFor(() => screen.getByText(/Health Check Summary/i));
    expect(screen.getByText(/Based on last 3 months/i)).toBeDefined();
    expect(screen.getByText(/Runway warnings when/i)).toBeDefined();
  });

  it("loadCosts throw → logError pero UI continúa renderizando estado normal", async () => {
    usePnlMetricsMock.mockReturnValue({ trades: [], loading: false });
    loadCostsMock.mockRejectedValue(new Error("supabase rls denied"));

    render(<HealthPanel />);

    await waitFor(() => {
      expect(logErrorMock).toHaveBeenCalledWith(
        "HealthPanel",
        expect.objectContaining({ error: expect.stringMatching(/rls denied/) }),
      );
    });
    // UI still mounts the Health & Alerts header.
    expect(screen.getByText(/Health & Alerts/i)).toBeDefined();
  });
});
