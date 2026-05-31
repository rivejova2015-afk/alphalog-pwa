// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepLatencyArbPairing, type BotAccount } from "../NewStrategyWizard.client";

// The wizard module imports several browser-only deps (Supabase client, router).
// Mocking these keeps the test focused on the StepLatencyArbPairing sub-form.
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation",        () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("sonner",                  () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ACCOUNTS: BotAccount[] = [
  { id: "acc-fast", label: "Broker A (MT5)", account_id: "1001" },
  { id: "acc-slow", label: "Broker B (MT5)", account_id: "2001" },
  { id: "acc-3rd",  label: "Broker C (MT5)", account_id: "3001" },
];

const DEFAULT_CFG = {
  max_skew_points:  "30",
  min_pulse_ticks:  "5",
  pulse_window_ms:  "800",
  min_hold_seconds: "60",
  max_hold_seconds: "300",
};

describe("StepLatencyArbPairing — collision validation", () => {
  it("shows the same-account collision warning when fast === slow", () => {
    render(
      <StepLatencyArbPairing
        botAccounts={ACCOUNTS}
        fastBotAccountId="acc-fast"
        slowBotAccountId="acc-fast"
        setSlowBotAccountId={() => {}}
        cfg={DEFAULT_CFG}
        setCfg={() => {}}
      />,
    );
    expect(screen.getByText(/no pueden ser la misma cuenta/i)).toBeInTheDocument();
  });

  it("does NOT show collision warning when fast !== slow", () => {
    render(
      <StepLatencyArbPairing
        botAccounts={ACCOUNTS}
        fastBotAccountId="acc-fast"
        slowBotAccountId="acc-slow"
        setSlowBotAccountId={() => {}}
        cfg={DEFAULT_CFG}
        setCfg={() => {}}
      />,
    );
    expect(screen.queryByText(/no pueden ser la misma cuenta/i)).not.toBeInTheDocument();
  });

  it("excludes the fast account from the slow broker dropdown options", () => {
    render(
      <StepLatencyArbPairing
        botAccounts={ACCOUNTS}
        fastBotAccountId="acc-fast"
        slowBotAccountId=""
        setSlowBotAccountId={() => {}}
        cfg={DEFAULT_CFG}
        setCfg={() => {}}
      />,
    );
    // The select should NOT have an option matching the fast account label
    const options = screen.getAllByRole("option");
    const labels  = options.map((o) => o.textContent ?? "");
    expect(labels.some((l) => l.includes("Broker A"))).toBe(false);
    expect(labels.some((l) => l.includes("Broker B"))).toBe(true);
    expect(labels.some((l) => l.includes("Broker C"))).toBe(true);
  });
});
