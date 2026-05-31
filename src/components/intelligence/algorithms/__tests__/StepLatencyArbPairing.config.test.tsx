// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepLatencyArbPairing, type BotAccount } from "../NewStrategyWizard.client";

vi.mock("@/lib/supabase/browser", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation",        () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("sonner",                  () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ACCOUNTS: BotAccount[] = [
  { id: "acc-fast", label: "Broker Fast", account_id: "1001" },
  { id: "acc-slow", label: "Broker Slow", account_id: "2001" },
];

describe("StepLatencyArbPairing — config callbacks", () => {
  it("setCfg fires with key max_skew_points when input changes", async () => {
    const user = userEvent.setup();
    const setCfg = vi.fn();
    render(
      <StepLatencyArbPairing
        botAccounts={ACCOUNTS}
        fastBotAccountId="acc-fast"
        slowBotAccountId="acc-slow"
        setSlowBotAccountId={() => {}}
        cfg={{
          max_skew_points:  "30",
          min_pulse_ticks:  "5",
          pulse_window_ms:  "800",
          min_hold_seconds: "60",
          max_hold_seconds: "300",
        }}
        setCfg={setCfg}
      />,
    );

    const inputs = screen.getAllByRole("spinbutton");  // <input type=number>
    expect(inputs.length).toBeGreaterThanOrEqual(5);

    // The first numeric input is "Max skew (pts)".
    await user.clear(inputs[0]);
    await user.type(inputs[0], "45");

    // Each keystroke fires setCfg with the matching key. We only verify the
    // key here — the new value is the controlled-input string at that tick.
    expect(setCfg).toHaveBeenCalled();
    const firstCall = setCfg.mock.calls[0];
    expect(firstCall[0]).toBe("max_skew_points");
  });

  it("setSlowBotAccountId fires when slow broker dropdown changes", async () => {
    const user = userEvent.setup();
    const setSlow = vi.fn();
    render(
      <StepLatencyArbPairing
        botAccounts={ACCOUNTS}
        fastBotAccountId="acc-fast"
        slowBotAccountId=""
        setSlowBotAccountId={setSlow}
        cfg={{
          max_skew_points:  "30",
          min_pulse_ticks:  "5",
          pulse_window_ms:  "800",
          min_hold_seconds: "60",
          max_hold_seconds: "300",
        }}
        setCfg={() => {}}
      />,
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "acc-slow");

    expect(setSlow).toHaveBeenCalledWith("acc-slow");
  });
});
