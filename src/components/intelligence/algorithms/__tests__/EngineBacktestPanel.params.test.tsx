// @vitest-environment jsdom
//
// EngineBacktestPanel — Compare params snapshot (Mejora #7).
// Verifies the new "Params usados" section under the metrics table in
// CompareView: 8 rows, per-cell color depending on uniformity, formatter
// behavior for missing/odd values.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn(), message: vi.fn() } }));
// EquityCurve unmocked so the section below the params is rendered normally;
// the params section sits between the metrics table and the equity overlap.
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

type ParamsShape = Partial<{
  starting_equity:         number;
  sl_atr_mult:             number;
  tp_atr_mult:             number;
  monte_carlo_iterations:  number;
  walk_forward_windows:    number;
  use_ml:                  boolean;
  use_multi_tf_requested:  boolean;
  use_portfolio_requested: boolean;
}>;

function makeRun(id: string, daysAgo: number, params: ParamsShape) {
  const now = Date.now();
  const created = new Date(now - daysAgo * 24 * 60 * 60_000).toISOString();
  const equity_curve = Array.from({ length: 30 }, (_, i) => ({
    ts: new Date(now - (30 - i) * 60 * 60_000).toISOString(),
    equity: 10_000 + i * 10,
  }));
  return {
    id,
    symbol: "EURUSD",
    range_from: created,
    range_to: created,
    params,
    baseline_metrics: {
      totalTrades: 25,
      winRate: 0.55,
      totalPnl: 500,
      sharpe: 1.0,
      sortino: 1.2,
      profitFactor: 1.5,
      maxDrawdownPct: 0.05,
      expectancy: 20,
    },
    equity_curve,
    final_balance: 10_500,
    total_trades: 25,
    duration_ms: 3000,
    monte_carlo: null,
    walk_forward: null,
    bars_loaded: [],
    advanced: null,
    created_at: created,
  };
}

function mockFetch(history: ReturnType<typeof makeRun>[]) {
  globalThis.fetch = vi.fn(async (url: string) => {
    if (url.includes("/history")) return { ok: true, json: async () => ({ runs: history }) } as Response;
    if (url.includes("/symbol-status")) return { ok: true, json: async () => ({}) } as Response;
    return { ok: true, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
}

async function openCompareWith(runs: ReturnType<typeof makeRun>[]) {
  mockFetch(runs);
  render(<EngineBacktestPanel algorithmId="algo-1" instruments={["EURUSD"]} />);
  await waitFor(() => expect(screen.queryByText(/Comparar runs/)).not.toBeNull());
  const badges = screen.getAllByText(/EURUSD · \$/);
  runs.forEach((_, i) => fireEvent.click(badges[i]));
  await waitFor(() => expect(screen.queryByTestId("compare-params")).not.toBeNull());
}

describe("EngineBacktestPanel — Compare params snapshot (Mejora #7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
  });

  it("renders the Params section under the metrics table when 2+ runs selected", async () => {
    await openCompareWith([
      makeRun("r1", 3, { sl_atr_mult: 1.5, tp_atr_mult: 3.0 }),
      makeRun("r2", 2, { sl_atr_mult: 2.0, tp_atr_mult: 3.0 }),
    ]);
    expect(screen.getByTestId("compare-params")).toBeDefined();
    expect(screen.getByText("Params usados")).toBeDefined();
  });

  it("renders all 8 param rows from COMPARE_PARAMS", async () => {
    await openCompareWith([
      makeRun("r1", 3, { sl_atr_mult: 1.5 }),
      makeRun("r2", 2, { sl_atr_mult: 2.0 }),
    ]);
    // Scope to the compare-params section — labels like "SL × ATR" also live
    // in the auto-tune results table when it's open, so an unscoped getByText
    // would collide there.
    const section = within(screen.getByTestId("compare-params"));
    const labels = [
      "Starting Equity", "SL × ATR", "TP × ATR", "Monte Carlo",
      "Walk-Forward", "ML overlay", "Multi-TF req.", "Portfolio req.",
    ];
    labels.forEach((label) => {
      expect(section.getByText(label)).toBeDefined();
    });
  });

  it("all-equal values render in neutral gray color (#475569)", async () => {
    await openCompareWith([
      makeRun("r1", 3, { tp_atr_mult: 3.0, walk_forward_windows: 4 }),
      makeRun("r2", 2, { tp_atr_mult: 3.0, walk_forward_windows: 4 }),
      makeRun("r3", 1, { tp_atr_mult: 3.0, walk_forward_windows: 4 }),
    ]);
    // All three cells of the TP row share the same value → all gray
    [0, 1, 2].forEach((i) => {
      const cell = screen.getByTestId(`param-cell-tp_atr_mult-${i}`);
      expect(cell.style.color).toBe("rgb(71, 85, 105)"); // #475569
    });
  });

  it("differing values render with each run's accent color (purple/cyan/yellow)", async () => {
    await openCompareWith([
      makeRun("r1", 3, { sl_atr_mult: 1.5 }),
      makeRun("r2", 2, { sl_atr_mult: 2.0 }),
      makeRun("r3", 1, { sl_atr_mult: 2.5 }),
    ]);
    const a = screen.getByTestId("param-cell-sl_atr_mult-0");
    const b = screen.getByTestId("param-cell-sl_atr_mult-1");
    const c = screen.getByTestId("param-cell-sl_atr_mult-2");
    expect(a.style.color).toBe("rgb(167, 139, 250)"); // #a78bfa purple
    expect(b.style.color).toBe("rgb(34, 211, 238)");  // #22d3ee cyan
    expect(c.style.color).toBe("rgb(251, 191, 36)");  // #fbbf24 yellow
  });

  it("formats values per kind (money/num/int/bool)", async () => {
    await openCompareWith([
      makeRun("r1", 3, {
        starting_equity: 10000,
        sl_atr_mult: 1.5,
        monte_carlo_iterations: 1000,
        use_ml: true,
      }),
      makeRun("r2", 2, {
        starting_equity: 25000,
        sl_atr_mult: 2.0,
        monte_carlo_iterations: 500,
        use_ml: false,
      }),
    ]);
    // money: starts with $ + locale-grouped digits
    expect(screen.getByTestId("param-cell-starting_equity-0").textContent).toMatch(/^\$10[,.]000$/);
    expect(screen.getByTestId("param-cell-starting_equity-1").textContent).toMatch(/^\$25[,.]000$/);
    // num with decimal
    expect(screen.getByTestId("param-cell-sl_atr_mult-0").textContent).toBe("1.50");
    // int (locale-grouped)
    expect(screen.getByTestId("param-cell-monte_carlo_iterations-0").textContent).toMatch(/^1[,.]000$/);
    // bool — Sí / No
    expect(screen.getByTestId("param-cell-use_ml-0").textContent).toBe("Sí");
    expect(screen.getByTestId("param-cell-use_ml-1").textContent).toBe("No");
  });

  it("missing keys render as em-dash and don't crash", async () => {
    await openCompareWith([
      makeRun("r1", 3, {}),                          // no params at all
      makeRun("r2", 2, { sl_atr_mult: 2.0 }),
    ]);
    // Both cells for starting_equity should be em-dash (missing on both sides)
    expect(screen.getByTestId("param-cell-starting_equity-0").textContent).toBe("—");
    expect(screen.getByTestId("param-cell-starting_equity-1").textContent).toBe("—");
    // sl_atr_mult: missing on A, present on B → not equal, both colored
    expect(screen.getByTestId("param-cell-sl_atr_mult-0").textContent).toBe("—");
    expect(screen.getByTestId("param-cell-sl_atr_mult-1").textContent).toBe("2.00");
  });
});
