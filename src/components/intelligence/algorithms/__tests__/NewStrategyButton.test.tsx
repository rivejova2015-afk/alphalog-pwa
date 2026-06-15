// @vitest-environment jsdom
//
// NewStrategyButton — thin opener for the wizard. Validates:
//   1. Renders the "New Strategy" button.
//   2. Wizard is NOT rendered until the button is clicked.
//   3. Clicking the button toggles the wizard open.
//   4. Wizard onClose callback (close X / overlay / cancel) closes it again.

import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

const { onCloseCapture } = vi.hoisted(() => ({
  onCloseCapture: { fn: null as null | (() => void) },
}));

// Stub NewStrategyWizard with a sentinel so we know when it's mounted and we
// can trigger its onClose without driving the real wizard's heavy form.
vi.mock("../NewStrategyWizard.client", () => ({
  NewStrategyWizard: ({ onClose }: { onClose: () => void }) => {
    onCloseCapture.fn = onClose;
    return <div data-testid="wizard-stub">wizard open</div>;
  },
}));

import { NewStrategyButton } from "../NewStrategyButton.client";

describe("NewStrategyButton", () => {
  it("renders the 'New Strategy' button", () => {
    render(<NewStrategyButton />);
    expect(screen.getByRole("button", { name: /New Strategy/i })).toBeDefined();
  });

  it("does NOT render the wizard until the button is clicked", () => {
    render(<NewStrategyButton />);
    expect(screen.queryByTestId("wizard-stub")).toBeNull();
  });

  it("opens the wizard on button click and closes on onClose", () => {
    render(<NewStrategyButton />);
    fireEvent.click(screen.getByRole("button", { name: /New Strategy/i }));
    expect(screen.getByTestId("wizard-stub")).toBeDefined();

    // Fire the onClose callback the wizard would invoke (close button,
    // overlay click, etc.). The button component should unmount it.
    // Wrap in act() so React flushes the setOpen(false) state update before
    // we assert — fireEvent auto-wraps, direct callback invocation doesn't.
    act(() => {
      onCloseCapture.fn?.();
    });
    expect(screen.queryByTestId("wizard-stub")).toBeNull();
  });
});
