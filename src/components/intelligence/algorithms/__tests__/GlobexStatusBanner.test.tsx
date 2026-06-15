// @vitest-environment jsdom
//
// GlobexStatusBanner — server component that conditionally renders an
// amber InfoBanner when CME Globex is closed (Sprint BB).
//
// The component is a pure function call to isGlobexOpen() — we mock that
// helper to drive the render branches deterministically.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { isGlobexOpenMock } = vi.hoisted(() => ({
  isGlobexOpenMock: vi.fn(),
}));
vi.mock("@/lib/cme/market-hours", () => ({
  isGlobexOpen: isGlobexOpenMock,
}));

// Import AFTER the mock so the component resolves to our mocked helper.
import { GlobexStatusBanner } from "../GlobexStatusBanner";

describe("GlobexStatusBanner", () => {
  beforeEach(() => {
    isGlobexOpenMock.mockReset();
  });

  it("renders null when Globex is open (keeps the page clean)", () => {
    isGlobexOpenMock.mockReturnValue(true);
    const { container } = render(<GlobexStatusBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an amber InfoBanner when Globex is closed", () => {
    isGlobexOpenMock.mockReturnValue(false);
    render(<GlobexStatusBanner />);
    expect(screen.getByText(/CME Globex cerrado/i)).toBeDefined();
    expect(screen.getByText(/Dom 18:00 ET → Vie 17:00 ET/i)).toBeDefined();
  });

  it("explains that forex + crypto algos are NOT affected", () => {
    isGlobexOpenMock.mockReturnValue(false);
    render(<GlobexStatusBanner />);
    // Specifically tells the user this only applies to CME futures.
    expect(screen.getByText(/forex.*MT4\/MT5.*y crypto.*Coinarb.*no se ven afectados/i)).toBeDefined();
  });

  it("uses role='note' for the amber banner (a11y)", () => {
    isGlobexOpenMock.mockReturnValue(false);
    render(<GlobexStatusBanner />);
    const banner = screen.getByRole("note");
    expect(banner).toBeDefined();
  });
});
