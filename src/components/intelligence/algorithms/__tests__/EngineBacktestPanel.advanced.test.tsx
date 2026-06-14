// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("../EquityCurve", () => ({ EquityCurve: () => null }));
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

const BACKTEST_PAYLOAD = {
  algorithm: { id: "algo-1", name: "Test", status: "draft" },
  symbol:    "XAUUSD",
  from:      "2026-01-01T00:00:00Z",
  to:        "2026-03-01T00:00:00Z",
  bars_loaded: [{ tf: "M15", count: 1000 }],
  result: {
    metrics:      { totalTrades: 0 },
    equityCurve:  [],
    finalBalance: 10000,
    durationMs:   42,
    trades:       [],
  },
  monte_carlo:       null,
  walk_forward:      null,
  advanced:          { ml: { used: true, trainAcc: 0.6, validAcc: 0.55, featureNames: ["a", "b"] }, multiTf: null, portfolio: null },
  advanced_warnings: [],
  gates:             null,
  promoted:          false,
  run_id:            "run-xyz",
  created_at:        new Date().toISOString(),
};

/**
 * Return a text/event-stream Response that emits a single `done` event with
 * the full backtest payload. Matches what runValidation produces server-side
 * when called via the SSE path (`?stream=true`).
 */
function sseResponse(payload: unknown): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Emit meta first so the hook flips `meta` to non-null, then `done` so
      // it sets `result` and clears `isStreaming`.
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify({ symbol: "XAUUSD", from: "x", to: "y", bars_loaded: [] })}\n\n`));
      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify(payload)}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function buildFetchMock(captures: { url: string; body: unknown }[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.body) {
      captures.push({ url, body: JSON.parse(init.body as string) });
    }
    if (url.includes("/history")) {
      return { ok: true, json: async () => ({ runs: [] }) } as Response;
    }
    if (url.includes("/symbol-status")) {
      return { ok: true, json: async () => ({}) } as Response;
    }
    if (url.includes("/engine-backtest")) {
      // The run button uses streaming (`?stream=true`); return an SSE body.
      return sseResponse(BACKTEST_PAYLOAD);
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("EngineBacktestPanel — advanced toggles (Gap #1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the three opt-in toggles", () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    expect(screen.getByTestId("toggle-use-ml")).toBeDefined();
    expect(screen.getByTestId("toggle-use-multi-tf")).toBeDefined();
    expect(screen.getByTestId("toggle-use-portfolio")).toBeDefined();
  });

  it("sends use_ml/use_multi_tf/use_portfolio=false by default in the run body", async () => {
    const captures: { url: string; body: unknown }[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(captures.some((c) => c.url.includes("/engine-backtest"))).toBe(true);
    });
    const runCall = captures.find((c) => c.url.includes("/engine-backtest"))!;
    const body = runCall.body as Record<string, unknown>;
    expect(body.use_ml).toBe(false);
    expect(body.use_multi_tf).toBe(false);
    expect(body.use_portfolio).toBe(false);
    // Walk-forward auto: default opt-out es 4 ventanas (Mejora #3).
    expect(body.walk_forward_windows).toBe(4);
  });

  it("ML toggle activates use_ml but multi-TF and portfolio stay disabled (hardening Gap #4)", async () => {
    const captures: { url: string; body: unknown }[] = [];
    globalThis.fetch = buildFetchMock(captures) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    const multiTf = screen.getByTestId("toggle-use-multi-tf") as HTMLInputElement;
    const portfolio = screen.getByTestId("toggle-use-portfolio") as HTMLInputElement;
    // The two cosmetic toggles are disabled in the sync panel by design —
    // Engine v1 already runs the multi-TF SMC funnel, and portfolio needs
    // the async flow's leg editor.
    expect(multiTf.disabled).toBe(true);
    expect(portfolio.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("toggle-use-ml"));
    // Clicks on disabled inputs are no-ops; we still issue them defensively
    // to prove the body shape doesn't drift.
    fireEvent.click(multiTf);
    fireEvent.click(portfolio);
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(captures.some((c) => c.url.includes("/engine-backtest"))).toBe(true);
    });
    const runCall = captures.find((c) => c.url.includes("/engine-backtest"))!;
    const body = runCall.body as Record<string, unknown>;
    expect(body.use_ml).toBe(true);
    expect(body.use_multi_tf).toBe(false);
    expect(body.use_portfolio).toBe(false);
  });

  it("renders the advanced results card when response.advanced is populated", async () => {
    globalThis.fetch = buildFetchMock([]) as unknown as typeof fetch;
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByTestId("toggle-use-ml"));
    fireEvent.click(screen.getByText(/Validar Engine/));
    await waitFor(() => {
      expect(screen.queryByTestId("advanced-results")).not.toBeNull();
    });
    expect(screen.getByText(/ML Signal/)).toBeDefined();
  });

  it("shows insufficient-data warning when walk-forward returns empty windows (Mejora #3)", async () => {
    // Server returned a walk_forward block but windows=[] because bars < 200*N.
    // Engine v1's silent fallback used to leave the user without explanation;
    // the UI now surfaces a warning naming the exact bar requirement.
    const payload = {
      ...BACKTEST_PAYLOAD,
      walk_forward: { windows: [], avgSharpe: 0, sharpeStdDev: 0, consistency: 0, profitableWindows: 0 },
    };
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("/history")) return { ok: true, json: async () => ({ runs: [] }) } as Response;
      if (url.includes("/symbol-status")) return { ok: true, json: async () => ({}) } as Response;
      if (url.includes("/engine-backtest")) return sseResponse(payload);
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    fireEvent.click(screen.getByText(/Validar Engine/));

    await waitFor(() => {
      expect(screen.queryByTestId("walk-forward-insufficient")).not.toBeNull();
    });
    // Default es 4 ventanas → 200*4 = 800 bars requeridos.
    expect(screen.getByText(/Walk-forward requiere ≥800 bars/)).toBeDefined();
  });
});
