// @vitest-environment jsdom
//
// Component-level tests for the 4 widgets of the Coinarb monitoring tab.
// We test the widgets in isolation (not the full panel with fetching) so the
// tests stay fast and deterministic. The fetch wiring is one effect with one
// state machine; if the widgets render correctly given props, the panel
// reliability comes down to the API contract, which is covered separately.

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  RegimeDistribution24h,
  PerStrategyStats,
  RecentTradesTable,
  TopSkipReasons,
} from "../CoinarbMonitoringPanel.client";

describe("RegimeDistribution24h", () => {
  it("renders an empty-state copy when buckets is empty", () => {
    render(<RegimeDistribution24h buckets={[]} />);
    expect(screen.getByTestId("empty-regime-distribution")).toBeInTheDocument();
  });

  it("renders one row per bucket with pct and hours", () => {
    render(
      <RegimeDistribution24h
        buckets={[
          { regime: "RANGE_HIGH", hours: 18.0, pct: 0.75 },
          { regime: "DEAD", hours: 6.0, pct: 0.25 },
        ]}
      />,
    );
    expect(screen.getByTestId("regime-row-RANGE_HIGH")).toHaveTextContent(/75\.0%/);
    expect(screen.getByTestId("regime-row-RANGE_HIGH")).toHaveTextContent(/18h/);
    expect(screen.getByTestId("regime-row-DEAD")).toHaveTextContent(/25\.0%/);
  });
});

describe("PerStrategyStats", () => {
  const baseStats = {
    A: { enters: 0, exits: 0, winRate: 0, pnlR: 0, isCurrentlyDispatched: false },
    B: { enters: 0, exits: 0, winRate: 0, pnlR: 0, isCurrentlyDispatched: false },
    M: { enters: 0, exits: 0, winRate: 0, pnlR: 0, isCurrentlyDispatched: false },
    P: { enters: 0, exits: 0, winRate: 0, pnlR: 0, isCurrentlyDispatched: false },
  };

  it("renders 4 strategy tiles", () => {
    render(<PerStrategyStats stats={baseStats} />);
    expect(screen.getByTestId("strategy-tile-A")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-B")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-M")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-P")).toBeInTheDocument();
  });

  it("flags the dispatched strategy with LIVE badge and a data attr", () => {
    const stats = { ...baseStats, M: { ...baseStats.M, isCurrentlyDispatched: true } };
    render(<PerStrategyStats stats={stats} />);
    expect(screen.getByTestId("dispatched-M")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("strategy-tile-M")).toHaveAttribute("data-dispatched", "true");
    expect(screen.getByTestId("strategy-tile-A")).toHaveAttribute("data-dispatched", "false");
  });

  it("shows winRate as `—` when exits == 0 even if winRate is 0", () => {
    render(<PerStrategyStats stats={baseStats} />);
    const tile = screen.getByTestId("strategy-tile-A");
    expect(within(tile).getByText("—")).toBeInTheDocument();
  });

  it("renders winRate percent when there are exits", () => {
    const stats = {
      ...baseStats,
      A: { ...baseStats.A, enters: 4, exits: 4, winRate: 0.75, pnlR: 1.5 },
    };
    render(<PerStrategyStats stats={stats} />);
    const tile = screen.getByTestId("strategy-tile-A");
    expect(within(tile).getByText("75%")).toBeInTheDocument();
    expect(within(tile).getByText("+1.50R")).toBeInTheDocument();
  });

  it("colors negative pnlR red and positive green", () => {
    const stats = {
      ...baseStats,
      A: { ...baseStats.A, enters: 2, exits: 2, winRate: 0, pnlR: -1.2 },
      B: { ...baseStats.B, enters: 2, exits: 2, winRate: 1, pnlR: 2.0 },
    };
    render(<PerStrategyStats stats={stats} />);
    const aTile = screen.getByTestId("strategy-tile-A");
    const bTile = screen.getByTestId("strategy-tile-B");
    expect(within(aTile).getByText("-1.20R").className).toMatch(/text-red/);
    expect(within(bTile).getByText("+2.00R").className).toMatch(/text-emerald/);
  });
});

describe("RecentTradesTable", () => {
  it("renders empty-state copy when there are no trades", () => {
    render(<RecentTradesTable trades={[]} />);
    expect(screen.getByTestId("empty-recent-trades")).toBeInTheDocument();
  });

  it("renders one row per trade with key columns", () => {
    render(
      <RecentTradesTable
        trades={[
          {
            id: "pos1", symbol: "BTC-USD", strategyId: "M", direction: "BUY",
            entryPrice: 100, exitPrice: 110, pnlUsd: 5, exitReason: "TP",
            openedAt: "2026-06-22T00:00:00Z", closedAt: "2026-06-22T01:00:00Z",
            regime: "RANGE_LOW",
          },
        ]}
      />,
    );
    const row = screen.getByTestId("trade-row-pos1");
    expect(within(row).getByText("BTC")).toBeInTheDocument();
    expect(within(row).getByText("M")).toBeInTheDocument();
    expect(within(row).getByText("BUY")).toBeInTheDocument();
    expect(within(row).getByText("+$5.00")).toBeInTheDocument();
    expect(within(row).getByText("TP")).toBeInTheDocument();
  });

  it("renders pnl='open' when pnlUsd is null", () => {
    render(
      <RecentTradesTable
        trades={[
          {
            id: "open1", symbol: "ETH-USD", strategyId: "A", direction: "SELL",
            entryPrice: 2500, exitPrice: null, pnlUsd: null, exitReason: null,
            openedAt: "t", closedAt: null, regime: "RANGE_HIGH",
          },
        ]}
      />,
    );
    const row = screen.getByTestId("trade-row-open1");
    expect(within(row).getByText("open")).toBeInTheDocument();
  });
});

describe("TopSkipReasons", () => {
  it("renders empty-state when no reasons", () => {
    render(<TopSkipReasons reasons={[]} />);
    expect(screen.getByTestId("empty-top-skip-reasons")).toBeInTheDocument();
  });

  it("renders ranked rows with count + strategy id", () => {
    render(
      <TopSkipReasons
        reasons={[
          { reason: "liquidity-sweep: not detected", count: 200, strategyId: "A" },
          { reason: "mtf confidence below floor", count: 50, strategyId: "A" },
        ]}
      />,
    );
    const row0 = screen.getByTestId("skip-row-0");
    expect(within(row0).getByText("liquidity-sweep: not detected")).toBeInTheDocument();
    expect(within(row0).getByText(/200/)).toBeInTheDocument();
    const row1 = screen.getByTestId("skip-row-1");
    expect(within(row1).getByText("mtf confidence below floor")).toBeInTheDocument();
  });
});
