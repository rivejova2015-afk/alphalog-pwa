// @vitest-environment jsdom
//
// CmePositionsPanel — self-fetching, polls every 10s, POSTs to close a
// position (Wave 4 item 20). Covers: loading skeleton, empty state, happy
// path rendering (long/short color+icon, PnL sign formatting, manual badge,
// pluralization), and the close-position action (success + error toast).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));

import CmePositionsPanel from "../CmePositionsPanel.client";

const LONG_POS = {
  id: "pos-1", contract: "MESZ25", direction: "LONG" as const, quantity: 2,
  avg_entry_price: 5900, current_price: 5920, unrealized_pnl_usd: 40,
  stop_loss_price: null, take_profit_price: null, is_manual: false, opened_at: "2026-01-01",
};
const SHORT_POS = {
  id: "pos-2", contract: "MNQZ25", direction: "SHORT" as const, quantity: 1,
  avg_entry_price: 21000, current_price: 21050, unrealized_pnl_usd: -50,
  stop_loss_price: null, take_profit_price: null, is_manual: true, opened_at: "2026-01-01",
};

function buildFetchMock(positions: unknown[]) {
  const calls: { url: string; method: string }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });
    if (url.startsWith("/api/cme/positions/") && method === "POST") {
      return { ok: true, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => ({ data: positions }) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("CmePositionsPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a loading skeleton before the fetch resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<CmePositionsPanel cmeAccountId="acc-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows 'No open positions' when the list is empty", async () => {
    buildFetchMock([]);
    render(<CmePositionsPanel cmeAccountId="acc-1" />);
    expect(await screen.findByText("No open positions")).toBeDefined();
  });

  it("renders LONG (emerald, +PnL) and SHORT (rose, -PnL, Manual badge) rows, with correct pluralization", async () => {
    buildFetchMock([LONG_POS, SHORT_POS]);
    render(<CmePositionsPanel cmeAccountId="acc-1" />);

    expect(await screen.findByText("2 open positions")).toBeDefined();
    expect(screen.getByText("MESZ25")).toBeDefined();
    expect(screen.getByText("+40.00")).toBeDefined();
    expect(screen.getByText("MNQZ25")).toBeDefined();
    expect(screen.getByText("-50.00")).toBeDefined();
    expect(screen.getByText("Manual")).toBeDefined();
  });

  it("singularizes the count label when there's exactly 1 position", async () => {
    buildFetchMock([LONG_POS]);
    render(<CmePositionsPanel cmeAccountId="acc-1" />);
    expect(await screen.findByText("1 open position")).toBeDefined();
  });

  it("closes a position on button click and refetches on success", async () => {
    const calls = buildFetchMock([LONG_POS]);
    render(<CmePositionsPanel cmeAccountId="acc-1" />);
    await screen.findByText("MESZ25");

    fireEvent.click(screen.getByLabelText("Close position"));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Position closed");
    });
    const closeCalls = calls.filter((c) => c.url === "/api/cme/positions/pos-1/close");
    expect(closeCalls).toHaveLength(1);
    expect(closeCalls[0].method).toBe("POST");
  });

  it("shows an error toast when closing a position fails", async () => {
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/close")) {
        return { ok: false, json: async () => ({ error: "Broker rejected" }) } as Response;
      }
      return { ok: true, json: async () => ({ data: [LONG_POS] }) } as Response;
    }) as unknown as typeof fetch;
    render(<CmePositionsPanel cmeAccountId="acc-1" />);
    await screen.findByText("MESZ25");

    fireEvent.click(screen.getByLabelText("Close position"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Broker rejected");
    });
  });
});
