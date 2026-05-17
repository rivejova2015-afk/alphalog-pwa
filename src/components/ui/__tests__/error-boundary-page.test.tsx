// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundaryPage } from "../error-boundary-page";

// Mock the logger so tests don't try to talk to AlphaShield.
vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

describe("ErrorBoundaryPage", () => {
  const baseProps = {
    error: Object.assign(new Error("boom"), { digest: "abc123" }),
    reset: () => {},
    scope: "test-scope",
  };

  it("renders scope name and error message", () => {
    render(<ErrorBoundaryPage {...baseProps} reset={() => {}} />);
    expect(screen.getByText(/test-scope error/i)).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("calls reset when Try again is clicked", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorBoundaryPage {...baseProps} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("renders a home link with the provided href", () => {
    render(
      <ErrorBoundaryPage {...baseProps} reset={() => {}} homeHref="/securities/cybersec" homeLabel="To CyberSec" />,
    );
    const link = screen.getByRole("link", { name: /to cybersec/i });
    expect(link).toHaveAttribute("href", "/securities/cybersec");
  });
});
