// @vitest-environment jsdom
//
// TradesTable — pure-render trades grid. Validates:
//   1. Default demo trades cuando no se pasa prop.
//   2. Headers presentes (#, Dir, Instrument, Entry, Exit, Lots, Duration, P&L).
//   3. Row count limitada por maxRows (default 10).
//   4. "Showing X of Y trades" footer cuando trades.length > maxRows.
//   5. No footer cuando trades.length <= maxRows.
//   6. BUY direction color emerald, SELL color red.
//   7. P&L positive shows "+$X.XX" emerald; negative shows "$-X.XX" red
//      (mismo format que AlgoCard).
//   8. Empty trades array → solo headers, no rows.
//   9. Prices formateados con 2 decimales via .toFixed(2).

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

// Stub formatters helpers to keep tests focused on TradesTable's own logic.
vi.mock("@/utils/formatters", () => ({
  formatDate:     (s: string) => s,
  formatDuration: (s: number) => `${Math.round(s / 60)}m`,
}));

import { TradesTable } from "../TradesTable";

interface Trade {
  id: string;
  trade_number: number;
  direction: "BUY" | "SELL";
  instrument: string;
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  lot_size: number;
  pnl: number;
  duration_seconds: number;
}

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id:               over.id ?? "t-1",
    trade_number:     over.trade_number ?? 1,
    direction:        over.direction ?? "BUY",
    instrument:       over.instrument ?? "XAU/USD",
    entry_price:      over.entry_price ?? 2000,
    exit_price:       over.exit_price ?? 2010,
    entry_time:       over.entry_time ?? "2026-06-12T10:00:00Z",
    exit_time:        over.exit_time ?? "2026-06-12T11:00:00Z",
    lot_size:         over.lot_size ?? 0.1,
    pnl:              over.pnl ?? 100,
    duration_seconds: over.duration_seconds ?? 3600,
  };
}

describe("TradesTable", () => {
  it("renders the default DEMO_TRADES when no prop is passed", () => {
    // The component sets `trades = DEMO_TRADES` in the destructuring default,
    // but its TS interface marks `trades` required. Cast to bypass the static
    // check — this test exercises the runtime fallback path.
    const TT = TradesTable as unknown as (props: Record<string, never>) => React.JSX.Element;
    render(<TT />);
    // Demo data has 5 trades — they should all be visible (maxRows=10 default).
    expect(screen.getAllByText("XAU/USD").length).toBe(5);
  });

  it("renders all 8 column headers", () => {
    render(<TradesTable trades={[trade()]} />);
    for (const h of ["#", "Dir", "Instrument", "Entry", "Exit", "Lots", "Duration", "P&L"]) {
      expect(screen.getByText(h)).toBeDefined();
    }
  });

  it("limits rows to maxRows when more trades are passed", () => {
    const trades = Array.from({ length: 15 }, (_, i) => trade({ id: `t-${i}`, trade_number: i + 1 }));
    const { container } = render(<TradesTable trades={trades} maxRows={5} />);
    // 5 body rows + 1 header row = 6.
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(5);
  });

  it("renders the 'Showing X of Y' footer when trades exceed maxRows", () => {
    const trades = Array.from({ length: 12 }, (_, i) => trade({ id: `t-${i}` }));
    render(<TradesTable trades={trades} maxRows={5} />);
    expect(screen.getByText(/Showing 5 of 12 trades/i)).toBeDefined();
  });

  it("does NOT render the footer when trades fit within maxRows", () => {
    const trades = Array.from({ length: 3 }, (_, i) => trade({ id: `t-${i}` }));
    render(<TradesTable trades={trades} maxRows={10} />);
    expect(screen.queryByText(/Showing.*trades/i)).toBeNull();
  });

  it("colors BUY direction emerald and SELL direction red", () => {
    const trades = [
      trade({ id: "b", direction: "BUY",  trade_number: 1 }),
      trade({ id: "s", direction: "SELL", trade_number: 2 }),
    ];
    render(<TradesTable trades={trades} />);
    const buyCell  = screen.getByText("BUY");
    const sellCell = screen.getByText("SELL");
    expect(buyCell.className).toContain("[#34d399]");
    expect(sellCell.className).toContain("[#ef4444]");
  });

  it("renders positive P&L with '+$' prefix in emerald", () => {
    const trades = [trade({ pnl: 250.50 })];
    render(<TradesTable trades={trades} />);
    const pnlCell = screen.getByText("+$250.50");
    expect(pnlCell.className).toContain("[#34d399]");
  });

  it("renders negative P&L as '$-X.XX' in red (same convention as AlgoCard)", () => {
    const trades = [trade({ pnl: -75.25 })];
    render(<TradesTable trades={trades} />);
    const pnlCell = screen.getByText("$-75.25");
    expect(pnlCell.className).toContain("[#ef4444]");
  });

  it("renders 0 body rows when trades=[] is passed", () => {
    const { container } = render(<TradesTable trades={[]} />);
    expect(container.querySelectorAll("tbody tr").length).toBe(0);
    expect(screen.queryByText(/Showing.*trades/i)).toBeNull();
  });

  it("formats prices to 2 decimal places via .toFixed(2)", () => {
    const trades = [trade({ entry_price: 2334.5, exit_price: 2341.987 })];
    render(<TradesTable trades={trades} />);
    expect(screen.getByText("2334.50")).toBeDefined();
    expect(screen.getByText("2341.99")).toBeDefined();
  });

  it("renders the formatted duration cell via the formatDuration helper", () => {
    const trades = [trade({ duration_seconds: 3600 })];
    const { container } = render(<TradesTable trades={trades} />);
    // Stubbed formatDuration → '60m'.
    const row = container.querySelector("tbody tr") as HTMLTableRowElement;
    expect(within(row).getByText("60m")).toBeDefined();
  });
});
