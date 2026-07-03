// @vitest-environment jsdom
//
// CmeEquityCurve — self-fetching SVG sparkline (Wave 4 item 20). Covers:
//   - loading skeleton while the fetch is in flight.
//   - "Not enough data yet" empty state for <2 snapshots.
//   - happy path: correct polyline point count, up (emerald) vs down (rose)
//     stroke color, gradient id keyed to cmeAccountId, last-value label.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CmeEquityCurve from "../CmeEquityCurve.client";

function mockFetch(data: unknown, ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => ({ data }),
  })) as unknown as typeof fetch;
}

describe("CmeEquityCurve", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton before the fetch resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<CmeEquityCurve cmeAccountId="acc-1" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("shows 'Not enough data yet' when fewer than 2 snapshots exist", async () => {
    mockFetch([{ equity_usd: 1000, daily_pnl_usd: 0, snapshot_at: "2026-01-01" }]);
    render(<CmeEquityCurve cmeAccountId="acc-1" />);
    expect(await screen.findByText(/Not enough data yet/i)).toBeDefined();
  });

  it("renders an emerald (up) polyline with correct point count and last-value label when equity rose", async () => {
    mockFetch([
      { equity_usd: 1000, daily_pnl_usd: 0, snapshot_at: "2026-01-01" },
      { equity_usd: 1100, daily_pnl_usd: 100, snapshot_at: "2026-01-02" },
      { equity_usd: 1250, daily_pnl_usd: 150, snapshot_at: "2026-01-03" },
    ]);
    const { container } = render(<CmeEquityCurve cmeAccountId="acc-42" />);

    await waitFor(() => expect(container.querySelector("polyline")).not.toBeNull());
    const polyline = container.querySelector("polyline")!;
    expect(polyline.getAttribute("stroke")).toBe("#10b981");
    expect(polyline.getAttribute("points")?.trim().split(" ")).toHaveLength(3);

    const gradient = container.querySelector("linearGradient");
    expect(gradient?.id).toBe("cme-grad-acc-42");

    expect(await screen.findByText("$1,250")).toBeDefined();
  });

  it("renders a rose (down) polyline when equity fell", async () => {
    mockFetch([
      { equity_usd: 1250, daily_pnl_usd: 0, snapshot_at: "2026-01-01" },
      { equity_usd: 1000, daily_pnl_usd: -250, snapshot_at: "2026-01-02" },
    ]);
    const { container } = render(<CmeEquityCurve cmeAccountId="acc-1" />);

    await waitFor(() => expect(container.querySelector("polyline")).not.toBeNull());
    expect(container.querySelector("polyline")!.getAttribute("stroke")).toBe("#f43f5e");
  });

  it("treats a non-ok response as empty data (no crash)", async () => {
    mockFetch(null, false);
    render(<CmeEquityCurve cmeAccountId="acc-1" />);
    expect(await screen.findByText(/Not enough data yet/i)).toBeDefined();
  });
});
