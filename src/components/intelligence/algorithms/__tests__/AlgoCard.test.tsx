// @vitest-environment jsdom
//
// AlgoCard — pure-render stats card. Validates:
//   1. Renders name + status badge + market label.
//   2. P&L Today rendered con signo + colored emerald/red según signo.
//   3. subLine para forex/futures/options/crypto formatos distintos.
//   4. subLine con leg_b_instrument muestra "→".
//   5. Profit factor color: >=1.5 emerald, [1,1.5) yellow, <1 red.
//   6. Max drawdown bar width clamped al 100% incluso con negative input.
//   7. onClick handler attached cuando se pasa, cursor cambia a pointer.
//   8. Sin onClick: no cursor-pointer.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import { AlgoCard } from "../AlgoCard";

const BASE_PROPS = {
  id:           "a1",
  name:         "Test algo",
  marketType:   "forex" as const,
  instrument:   "XAUUSD",
  direction:    "both" as const,
  status:       "ACTIVE" as const,
  pnlToday:     150.5,
  pnlTotal:     5000,
  winRate:      62,
  totalTrades:  42,
  profitFactor: 1.8,
  maxDrawdown:  8,
};

describe("AlgoCard", () => {
  it("renders the name, status badge, and market label", () => {
    render(<AlgoCard {...BASE_PROPS} />);
    expect(screen.getByText("Test algo")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
    expect(screen.getByText(/Forex\/MT/)).toBeDefined();
  });

  it("renders P&L Today with a '+' prefix and emerald color for positive values", () => {
    const { container } = render(<AlgoCard {...BASE_PROPS} pnlToday={150.5} />);
    const pnlNode = screen.getByText("+$150.50");
    expect(pnlNode.className).toContain("[#34d399]");
    expect(container.textContent).toContain("Total: +$5,000");
  });

  it("renders P&L Today without leading '+' and uses red color for negative values", () => {
    render(<AlgoCard {...BASE_PROPS} pnlToday={-75.25} pnlTotal={-1200} />);
    // Code formats as `${prefix}$${value.toFixed(2)}` so negative becomes "$-75.25".
    const pnlNode = screen.getByText("$-75.25");
    expect(pnlNode.className).toContain("[#ef4444]");
    expect(screen.getByText(/Total: \$-1,200/)).toBeDefined();
  });

  it("renders different subLine formats per market type", () => {
    // Futures with direction='long'.
    const { unmount: u1 } = render(<AlgoCard {...BASE_PROPS} marketType="futures" direction="long" instrument="ESM5" />);
    expect(screen.getByText(/ESM5 · Long bias/i)).toBeDefined();
    u1();

    // Options with strategy from parameters.
    const { unmount: u2 } = render(<AlgoCard {...BASE_PROPS} marketType="options" direction="long" instrument="SPY" parameters={{ options_strategy: "iron_condor" }} />);
    expect(screen.getByText(/SPY · iron condor · Long bias/i)).toBeDefined();
    u2();

    // Crypto + both.
    render(<AlgoCard {...BASE_PROPS} marketType="crypto" instrument="BTC-USD" />);
    expect(screen.getByText(/BTC-USD · Both/i)).toBeDefined();
  });

  it("renders 'leg_a → leg_b' arrow in subLine when leg_b_instrument is set", () => {
    render(<AlgoCard {...BASE_PROPS} instrument="EURUSD" parameters={{ leg_b_instrument: "GBPUSD" }} />);
    expect(screen.getByText(/EURUSD → GBPUSD/)).toBeDefined();
  });

  it("colors profit factor by tiers: >=1.5 emerald, [1,1.5) yellow, <1 red", () => {
    const { unmount: u1 } = render(<AlgoCard {...BASE_PROPS} profitFactor={1.5} />);
    expect(screen.getByText("1.50").className).toContain("[#34d399]");
    u1();

    const { unmount: u2 } = render(<AlgoCard {...BASE_PROPS} profitFactor={1.2} />);
    expect(screen.getByText("1.20").className).toContain("[#eab308]");
    u2();

    render(<AlgoCard {...BASE_PROPS} profitFactor={0.7} />);
    expect(screen.getByText("0.70").className).toContain("[#ef4444]");
  });

  it("clamps the drawdown bar width to 100% even for inputs > 100", () => {
    const { container } = render(<AlgoCard {...BASE_PROPS} maxDrawdown={250} />);
    const bar = container.querySelector("div[style*='width']") as HTMLElement;
    expect(bar?.style.width).toBe("100%");
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    render(<AlgoCard {...BASE_PROPS} onClick={onClick} />);
    fireEvent.click(screen.getByText("Test algo"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does NOT apply cursor-pointer class when onClick is absent", () => {
    const { container } = render(<AlgoCard {...BASE_PROPS} />);
    // Root card div has the conditional cursor-pointer class. We just check
    // it's NOT present on the rendered tree.
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("cursor-pointer");
  });

  it("applies cursor-pointer + hover classes when onClick is provided", () => {
    const { container } = render(<AlgoCard {...BASE_PROPS} onClick={() => {}} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("cursor-pointer");
    expect(card.className).toContain("hover:border");
  });
});
