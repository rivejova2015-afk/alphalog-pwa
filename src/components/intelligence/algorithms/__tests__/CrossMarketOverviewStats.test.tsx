// @vitest-environment jsdom
//
// CrossMarketOverviewStats — self-fetching cross-market summary tiles
// (Wave 5 item 21). Covers: loading placeholder, error fallback, happy
// path rendering (equity/P&L/positions from /api/algorithms/overview),
// and that "Active Strategies" comes from the prop, not the fetch.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CrossMarketOverviewStats } from "../CrossMarketOverviewStats.client";

function mockFetch(body: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("CrossMarketOverviewStats", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders activeStrategies from the prop immediately (no fetch dependency)", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<CrossMarketOverviewStats activeStrategies={3} />);
    expect(screen.getByText("3")).toBeDefined();
    expect(screen.getByText("Active Strategies")).toBeDefined();
  });

  it("shows a loading placeholder for the fetched tiles before the response resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<CrossMarketOverviewStats activeStrategies={0} />);
    expect(screen.getAllByText("…").length).toBeGreaterThan(0);
  });

  it("shows a dash fallback when the fetch fails", async () => {
    mockFetch(null, false);
    render(<CrossMarketOverviewStats activeStrategies={0} />);
    await waitFor(() => {
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });

  it("renders equity/P&L/positions from the overview response", async () => {
    mockFetch({
      totals: { algorithmCount: 2, equityUsd: 1234.56, pnlUsd: 45.6, openPositions: 3 },
      byMarket: [
        { marketType: "forex", algorithmCount: 1, equityUsd: 1000, pnlUsd: 20, openPositions: 1 },
        { marketType: "futures", algorithmCount: 0, equityUsd: 0, pnlUsd: 0, openPositions: 0 },
        { marketType: "crypto", algorithmCount: 1, equityUsd: 234.56, pnlUsd: 25.6, openPositions: 2 },
      ],
    });
    render(<CrossMarketOverviewStats activeStrategies={2} />);

    expect(await screen.findByText("$1,234.56")).toBeDefined();
    expect(screen.getByText("+$45.60")).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
    // Breakdown hint only mentions markets with algorithmCount > 0.
    expect(screen.getByText(/Forex \+\$20\.00 · Crypto \+\$25\.60/)).toBeDefined();
  });

  it("renders a negative total P&L in red without a '+' sign", async () => {
    mockFetch({
      totals: { algorithmCount: 1, equityUsd: 900, pnlUsd: -100, openPositions: 1 },
      byMarket: [{ marketType: "forex", algorithmCount: 1, equityUsd: 900, pnlUsd: -100, openPositions: 1 }],
    });
    render(<CrossMarketOverviewStats activeStrategies={1} />);
    const pnl = await screen.findByText("$-100.00");
    expect(pnl.style.color).toBe("rgb(248, 113, 113)");
  });
});
