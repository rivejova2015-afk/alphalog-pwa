// @vitest-environment jsdom
//
// CoinarbMonitoringPanel + its 4 sub-widgets. The top-level component is
// covered with a mocked fetch (loading / error / data states); the sub-widgets
// are covered as pure-render units with synthetic fixtures.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  CoinarbMonitoringPanel,
  RegimeDistribution24hWidget,
  PerStrategyStatsWidget,
  RecentTradesWidget,
  TopSkipReasonsWidget,
  type MonitoringData,
} from "../CoinarbMonitoringPanel.client";

const fixture: MonitoringData = {
  regimeDistribution24h: [
    { regime: "TRENDING_HIGH", hours: 1.5, pct: 0.0625 },
    { regime: "TRENDING_LOW", hours: 0, pct: 0 },
    { regime: "RANGE_HIGH", hours: 18, pct: 0.75 },
    { regime: "RANGE_LOW", hours: 3, pct: 0.125 },
    { regime: "DEAD", hours: 1.5, pct: 0.0625 },
  ],
  recentTrades: [
    {
      id: "t1",
      symbol: "BTC-USD",
      strategyId: "A",
      direction: "BUY",
      entryPrice: 62000,
      exitPrice: 63000,
      pnlUsd: 5.12,
      exitReason: "TP",
      openedAt: "2026-06-22T10:00:00Z",
      closedAt: "2026-06-22T11:00:00Z",
      regime: "RANGE_HIGH",
      status: "CLOSED",
    },
    {
      id: "t2",
      symbol: "ETH-USD",
      strategyId: "M",
      direction: "SELL",
      entryPrice: 3200,
      exitPrice: 3250,
      pnlUsd: -2.4,
      exitReason: "SL",
      openedAt: "2026-06-22T09:00:00Z",
      closedAt: "2026-06-22T10:00:00Z",
      regime: "RANGE_LOW",
      status: "CLOSED",
    },
  ],
  perStrategyStats: {
    A: { enters: 2, exits: 2, winRate: 0.5, pnlUsd: 5.12, isCurrentlyDispatched: true },
    B: { enters: 0, exits: 0, winRate: 0, pnlUsd: 0, isCurrentlyDispatched: false },
    M: { enters: 1, exits: 1, winRate: 0, pnlUsd: -2.4, isCurrentlyDispatched: false },
    P: { enters: 0, exits: 0, winRate: 0, pnlUsd: 0, isCurrentlyDispatched: false },
  },
  topSkipReasons6h: [
    { reason: "liquidity-sweep: not detected", strategyId: "A", count: 420 },
    { reason: "mtf bias=NEUTRAL conf=0.06 (need >=0.12 BUY/SELL)", strategyId: "A", count: 87 },
    { reason: "premium-discount: macro=PREMIUM_micro=PREMIUM", strategyId: "A", count: 31 },
  ],
  currentRegime: "RANGE_HIGH",
  dispatchedStrategy: "A",
};

function mockFetchOk(body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function mockFetchFail() {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
}

describe("CoinarbMonitoringPanel — top level", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the skeleton on first mount", () => {
    mockFetchOk({ monitoring: fixture });
    render(<CoinarbMonitoringPanel algorithmId="abc" />);
    expect(screen.getByTestId("monitoring-skeleton")).toBeInTheDocument();
  });

  it("renders the panel with all 4 widgets after fetch resolves", async () => {
    mockFetchOk({ monitoring: fixture });
    render(<CoinarbMonitoringPanel algorithmId="abc" />);
    await waitFor(() => {
      expect(screen.getByTestId("coinarb-monitoring-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("regime-distribution-24h")).toBeInTheDocument();
    expect(screen.getByTestId("per-strategy-stats")).toBeInTheDocument();
    expect(screen.getByTestId("recent-trades")).toBeInTheDocument();
    expect(screen.getByTestId("top-skip-reasons")).toBeInTheDocument();
  });

  it("renders error state when fetch fails", async () => {
    mockFetchFail();
    render(<CoinarbMonitoringPanel algorithmId="abc" />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/No se pudo cargar el monitoring/)).toBeInTheDocument();
  });
});

describe("RegimeDistribution24hWidget", () => {
  it("renders all 5 regimes with their percentage", () => {
    render(<RegimeDistribution24hWidget data={fixture.regimeDistribution24h} />);
    expect(screen.getByText("Trend·High")).toBeInTheDocument();
    expect(screen.getByText("Range·High")).toBeInTheDocument();
    expect(screen.getByText("Range·Low")).toBeInTheDocument();
    expect(screen.getByText("Dead")).toBeInTheDocument();
    // RANGE_HIGH at 75%
    expect(screen.getByText("75.0%")).toBeInTheDocument();
  });

  it("shows empty state when no hours scored", () => {
    const empty = fixture.regimeDistribution24h.map((d) => ({ ...d, hours: 0, pct: 0 }));
    render(<RegimeDistribution24hWidget data={empty} />);
    expect(screen.getByText(/Sin datos aún/)).toBeInTheDocument();
  });

  it("displays total hours scored at the top", () => {
    render(<RegimeDistribution24hWidget data={fixture.regimeDistribution24h} />);
    // 1.5 + 0 + 18 + 3 + 1.5 = 24.0h
    expect(screen.getByText(/24\.0h scored/)).toBeInTheDocument();
  });
});

describe("PerStrategyStatsWidget", () => {
  it("renders 4 strategy tiles (A/B/M/P)", () => {
    render(<PerStrategyStatsWidget stats={fixture.perStrategyStats} />);
    expect(screen.getByTestId("strategy-tile-A")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-B")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-M")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-tile-P")).toBeInTheDocument();
  });

  it("highlights the currently-dispatched strategy", () => {
    render(<PerStrategyStatsWidget stats={fixture.perStrategyStats} />);
    expect(screen.getByTestId("strategy-tile-A")).toHaveAttribute("data-dispatched", "true");
    expect(screen.getByTestId("strategy-tile-B")).toHaveAttribute("data-dispatched", "false");
  });

  it("shows LIVE badge only on the dispatched tile", () => {
    render(<PerStrategyStatsWidget stats={fixture.perStrategyStats} />);
    const liveBadges = screen.getAllByText("LIVE");
    expect(liveBadges).toHaveLength(1);
  });

  it("renders winRate '—' when strategy has 0 exits", () => {
    render(<PerStrategyStatsWidget stats={fixture.perStrategyStats} />);
    const tileB = screen.getByTestId("strategy-tile-B");
    expect(tileB.textContent).toMatch(/—/);
  });
});

describe("RecentTradesWidget", () => {
  it("renders rows for each trade", () => {
    render(<RecentTradesWidget trades={fixture.recentTrades} />);
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("TP")).toBeInTheDocument();
    expect(screen.getByText("SL")).toBeInTheDocument();
  });

  it("shows empty state when there are no trades", () => {
    render(<RecentTradesWidget trades={[]} />);
    expect(screen.getByText(/Sin trades aún/)).toBeInTheDocument();
  });

  it("renders signed positive PnL with + prefix", () => {
    render(<RecentTradesWidget trades={fixture.recentTrades} />);
    // PnL values render inside a <td> with other whitespace from formatting,
    // so use a flexible matcher rather than an exact text match.
    expect(screen.getByText((content) => content.includes("+$5.12"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("-$2.40"))).toBeInTheDocument();
  });
});

describe("TopSkipReasonsWidget", () => {
  it("renders all skip reasons with their count", () => {
    render(<TopSkipReasonsWidget reasons={fixture.topSkipReasons6h} />);
    expect(screen.getByText(/liquidity-sweep/)).toBeInTheDocument();
    expect(screen.getByText("420")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
  });

  it("shows empty state when no SKIPs", () => {
    render(<TopSkipReasonsWidget reasons={[]} />);
    expect(screen.getByText(/Sin SKIPs registrados/)).toBeInTheDocument();
  });

  it("truncates reasons longer than 50 chars in the visible text", () => {
    // Force a reason > 50 chars to verify the truncation branch.
    const long = "x".repeat(80);
    render(<TopSkipReasonsWidget reasons={[{ reason: long, strategyId: "A", count: 1 }]} />);
    // The visible text ends in an ellipsis; the full string lives in title=.
    const ellipsisNode = screen.getByText(/x+…$/);
    expect(ellipsisNode).toBeInTheDocument();
    expect(ellipsisNode.textContent ?? "").toMatch(/^x{50}…$/);
  });

  it("displays the total at the top", () => {
    render(<TopSkipReasonsWidget reasons={fixture.topSkipReasons6h} />);
    // 420 + 87 + 31 = 538
    expect(screen.getByText("538 total")).toBeInTheDocument();
  });
});
