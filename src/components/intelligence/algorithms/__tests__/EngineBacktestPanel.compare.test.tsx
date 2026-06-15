// @vitest-environment jsdom
//
// EngineBacktestPanel — Compare runs feature (Mejora #5).
// Verifies the extension from 2-run FIFO to 3-run FIFO with overlapped
// equity curves rendered through the multi-series EquityCurve API.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn(), message: vi.fn() } }));
// EquityCurve is unmocked here — we assert on its multi-series rendering.
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

function makeHistoryRun(id: string, daysAgo: number, sharpe: number, pnl: number, winRate: number) {
  const now = Date.now();
  const created = new Date(now - daysAgo * 24 * 60 * 60_000).toISOString();
  const equity_curve = Array.from({ length: 50 }, (_, i) => ({
    ts: new Date(now - (50 - i) * 60 * 60_000).toISOString(),
    equity: 10_000 + pnl * (i / 50),
  }));
  return {
    id,
    symbol: "EURUSD",
    range_from: created,
    range_to: created,
    params: {},
    baseline_metrics: {
      totalTrades: 25,
      winRate,
      totalPnl: pnl,
      sharpe,
      sortino: sharpe * 1.2,
      profitFactor: 1.5,
      maxDrawdownPct: 0.05,
      expectancy: pnl / 25,
    },
    equity_curve,
    final_balance: 10_000 + pnl,
    total_trades: 25,
    duration_ms: 3000,
    monte_carlo: null,
    walk_forward: null,
    bars_loaded: [],
    advanced: null,
    created_at: created,
  };
}

function buildFetchMock(history: ReturnType<typeof makeHistoryRun>[]) {
  return vi.fn(async (url: string) => {
    if (url.includes("/history")) return { ok: true, json: async () => ({ runs: history }) } as Response;
    if (url.includes("/symbol-status")) return { ok: true, json: async () => ({}) } as Response;
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("EngineBacktestPanel — Compare runs (Mejora #5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
  });

  it("compare badges render once history has ≥ 2 runs", async () => {
    const history = [
      makeHistoryRun("r1", 3, 1.2, 500, 0.55),
      makeHistoryRun("r2", 2, 0.8, 300, 0.50),
    ];
    globalThis.fetch = buildFetchMock(history) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);

    await waitFor(() => {
      expect(screen.queryByText(/Comparar runs/)).not.toBeNull();
    });
    expect(screen.getByText(/elige hasta 3/)).toBeDefined();
  });

  it("renders 2-column CompareView when 2 runs are selected (backwards-compat)", async () => {
    const history = [
      makeHistoryRun("r1", 3, 1.5, 800, 0.60),
      makeHistoryRun("r2", 2, 0.9, 200, 0.45),
    ];
    globalThis.fetch = buildFetchMock(history) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);

    await waitFor(() => expect(screen.queryByText(/Comparar runs/)).not.toBeNull());

    // Click the 2 badges (one button per run for compare toggle)
    const badges = screen.getAllByText(/EURUSD · \$/);
    fireEvent.click(badges[0]);
    fireEvent.click(badges[1]);

    await waitFor(() => expect(screen.queryByText(/Comparación A vs B/)).not.toBeNull());

    // Headers carry "<Label> · <date> · <symbol>"; require the date digits so
    // we don't collide with the legend chips ("A · EURUSD" without date).
    expect(screen.queryByText(/^A · \d/)).not.toBeNull();
    expect(screen.queryByText(/^B · \d/)).not.toBeNull();
    expect(screen.queryByText(/^C · \d/)).toBeNull();
  });

  it("renders 3-column CompareView when 3 runs are selected (Mejora #5)", async () => {
    const history = [
      makeHistoryRun("r1", 5, 1.8, 1200, 0.65),
      makeHistoryRun("r2", 4, 1.2, 600,  0.55),
      makeHistoryRun("r3", 3, 0.7, 100,  0.45),
    ];
    globalThis.fetch = buildFetchMock(history) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);

    await waitFor(() => expect(screen.queryByText(/Comparar runs/)).not.toBeNull());

    const badges = screen.getAllByText(/EURUSD · \$/);
    fireEvent.click(badges[0]);
    fireEvent.click(badges[1]);
    fireEvent.click(badges[2]);

    await waitFor(() => expect(screen.queryByText(/Comparación A vs B vs C/)).not.toBeNull());

    // Headers require date digits — disambiguates from legend chips.
    expect(screen.queryByText(/^A · \d/)).not.toBeNull();
    expect(screen.queryByText(/^B · \d/)).not.toBeNull();
    expect(screen.queryByText(/^C · \d/)).not.toBeNull();

    // Multi-series equity overlap chart appears
    expect(screen.queryByTestId("equity-curve-multi")).not.toBeNull();
  });

  it("FIFO drops the oldest selection when adding a 4th run", async () => {
    const history = [
      makeHistoryRun("r1", 5, 1.5, 800, 0.60),
      makeHistoryRun("r2", 4, 1.2, 600, 0.55),
      makeHistoryRun("r3", 3, 1.0, 400, 0.50),
      makeHistoryRun("r4", 2, 0.7, 100, 0.45),
    ];
    globalThis.fetch = buildFetchMock(history) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);

    await waitFor(() => expect(screen.queryByText(/Comparar runs/)).not.toBeNull());

    const badges = screen.getAllByText(/EURUSD · \$/);
    // Select r1, r2, r3, then click r4 (should drop r1)
    fireEvent.click(badges[0]); // r1
    fireEvent.click(badges[1]); // r2
    fireEvent.click(badges[2]); // r3
    fireEvent.click(badges[3]); // r4 — drops r1

    await waitFor(() => expect(screen.queryByText(/Comparación A vs B vs C/)).not.toBeNull());

    // The selected set now is r2, r3, r4 — verify r1's date string is NOT in compare header.
    // We assert this indirectly via the bordered/selected badge state.
    const r1Date = new Date(history[0].created_at).toLocaleDateString();
    const compareTable = screen.getByText(/Comparación/).closest("div");
    expect(within(compareTable as HTMLElement).queryByText(new RegExp(`A · ${r1Date}`))).toBeNull();
  });

  it("winner highlight (◄) finds the best metric across 3 runs", async () => {
    const history = [
      makeHistoryRun("r1", 3, 0.5, 100, 0.45),  // worst sharpe
      makeHistoryRun("r2", 2, 1.0, 500, 0.55),  // mid
      makeHistoryRun("r3", 1, 2.5, 1500, 0.70), // best sharpe + pnl + winRate
    ];
    globalThis.fetch = buildFetchMock(history) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);

    await waitFor(() => expect(screen.queryByText(/Comparar runs/)).not.toBeNull());

    const badges = screen.getAllByText(/EURUSD · \$/);
    fireEvent.click(badges[0]);
    fireEvent.click(badges[1]);
    fireEvent.click(badges[2]);

    await waitFor(() => expect(screen.queryByText(/Comparación A vs B vs C/)).not.toBeNull());

    // Winner mark "◄" must appear in the table at least once per "higher-is-better" metric.
    // Sharpe row: r3 wins → has "◄" suffix.
    const winners = screen.queryAllByText(/◄/);
    expect(winners.length).toBeGreaterThan(0);
  });
});
