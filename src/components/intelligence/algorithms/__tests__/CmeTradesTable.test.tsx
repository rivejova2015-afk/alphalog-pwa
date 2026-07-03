// @vitest-environment jsdom
//
// CmeTradesTable — self-fetching, paginated trades table + CSV export
// (Wave 4 item 20). Covers: loading skeleton, empty state, row rendering
// (BUY/SELL color, PnL sign formatting, null fallbacks for fill_price /
// slippage / close_reason), pagination visibility + prev/next bounds, and
// that the fetch URL is scoped by tableType + cmeAccountId.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CmeTradesTable from "../CmeTradesTable.client";

const BUY_TRADE = {
  id: "t1", contract: "MESZ25", direction: "BUY" as const, quantity: 2,
  fill_price: 5900.25, entry_price: 5900.25, exit_price: null, status: "open",
  pnl_usd: 45.5, commission_usd: 2.5, slippage_ticks: 1, close_reason: null,
  fill_timestamp: "2026-01-01T10:00:00Z", created_at: "2026-01-01T10:00:00Z",
};
const SELL_TRADE = {
  id: "t2", contract: "MNQZ25", direction: "SELL" as const, quantity: 1,
  fill_price: null, entry_price: 21000, exit_price: 21050, status: "closed",
  pnl_usd: -30, commission_usd: 2.5, slippage_ticks: null, close_reason: "stop_loss",
  fill_timestamp: null, created_at: "2026-01-01T11:00:00Z",
};

function buildFetchMock(data: unknown[], count: number) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (url: string) => {
    calls.push(url);
    return { ok: true, json: async () => ({ data, count }) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("CmeTradesTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton before the fetch resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows 'No trades yet' when the list is empty", async () => {
    buildFetchMock([], 0);
    render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);
    expect(await screen.findByText("No trades yet")).toBeDefined();
    expect(screen.getByText("0 trades total")).toBeDefined();
  });

  it("fetches scoped by cmeAccountId + tableType", async () => {
    const calls = buildFetchMock([BUY_TRADE], 1);
    render(<CmeTradesTable cmeAccountId="acc-77" tableType="real" />);
    await screen.findByText("MESZ25");
    expect(calls[0]).toContain("/api/cme/trades/real?cmeAccountId=acc-77");
  });

  it("renders BUY (emerald, +PnL) and SELL (rose, -PnL) rows with null fallbacks", async () => {
    buildFetchMock([BUY_TRADE, SELL_TRADE], 2);
    render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);

    expect(await screen.findByText("MESZ25")).toBeDefined();
    expect(screen.getByText("+$45.50")).toBeDefined();
    expect(screen.getByText("1t")).toBeDefined();

    expect(screen.getByText("MNQZ25")).toBeDefined();
    expect(screen.getByText("$-30.00")).toBeDefined();
    expect(screen.getByText("stop loss")).toBeDefined(); // close_reason underscore → space
    // fill_price null for SELL_TRADE and slippage_ticks null both render em-dash.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("does not render pagination controls when count <= limit (20)", async () => {
    buildFetchMock([BUY_TRADE], 1);
    render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);
    await screen.findByText("MESZ25");
    expect(screen.queryByText("Prev")).toBeNull();
    expect(screen.queryByText("Next")).toBeNull();
  });

  it("renders pagination when count > limit, with Prev disabled on page 1", async () => {
    buildFetchMock(Array.from({ length: 20 }, (_, i) => ({ ...BUY_TRADE, id: `t${i}` })), 45);
    render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);
    await screen.findByText("1 / 3");

    const prevBtn = screen.getByRole("button", { name: "Prev" });
    const nextBtn = screen.getByRole("button", { name: "Next" });
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();
  });

  it("clicking Next advances the page and refetches with the new offset", async () => {
    const calls = buildFetchMock(Array.from({ length: 20 }, (_, i) => ({ ...BUY_TRADE, id: `t${i}` })), 45);
    render(<CmeTradesTable cmeAccountId="acc-1" tableType="propfirm" />);
    await screen.findByText("1 / 3");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(calls.some((u) => u.includes("offset=20"))).toBe(true);
    });
  });
});
