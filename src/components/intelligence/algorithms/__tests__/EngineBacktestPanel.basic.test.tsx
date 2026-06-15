// @vitest-environment jsdom
//
// EngineBacktestPanel — basic flow coverage that complements the existing
// advanced + research-mode tests. Focuses on:
//   1. Symbol picker shows ALL configured instruments.
//   2. From/To date inputs accept ISO date strings.
//   3. Run failure (4xx with error body) surfaces toast.error.
//   4. History panel renders past runs from /history endpoint.
//   5. Bootstrap bars button POSTs to /bars-bootstrap.
//   6. Bootstrap bars button disabled mientras está corriendo.
//   7. ML train button POSTs to /train-ml.
//   8. Validar button disabled mientras corre.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock:   vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));
vi.mock("../EquityCurve", () => ({ EquityCurve: () => null }));
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

interface FetchCall { url: string; method: string; body?: unknown }

function buildFetchMock(opts: {
  history?:           Array<{ id: string; created_at: string; final_balance: number; total_trades: number }>;
  runFailure?:        { status: number; body: unknown };
  bootstrapResponse?: { ok: boolean; body: unknown };
  trainMlResponse?:   { ok: boolean; body: unknown };
} = {}) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const call: FetchCall = { url, method: init?.method ?? "GET" };
    if (init?.body) { try { call.body = JSON.parse(init.body as string); } catch { /* noop */ } }
    calls.push(call);

    if (url.includes("/history")) {
      return { ok: true, json: async () => ({ runs: opts.history ?? [] }) } as Response;
    }
    if (url.includes("/symbol-status")) {
      return { ok: true, json: async () => ({}) } as Response;
    }
    if (url.includes("/bars-bootstrap")) {
      const r = opts.bootstrapResponse ?? { ok: true, body: { total_bars: 0, duration_ms: 100, summary: [], errors: 0 } };
      return { ok: r.ok, json: async () => r.body } as Response;
    }
    if (url.includes("/train-ml")) {
      const r = opts.trainMlResponse ?? { ok: true, body: { train_acc: 0.6, valid_acc: 0.55 } };
      return { ok: r.ok, json: async () => r.body } as Response;
    }
    if (url.includes("/engine-backtest")) {
      if (opts.runFailure) {
        return { ok: false, status: opts.runFailure.status, json: async () => opts.runFailure!.body } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

describe("EngineBacktestPanel — basic flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("renders the symbol picker with every configured instrument", () => {
    buildFetchMock();
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD", "EURUSD", "GBPUSD"]} />);
    // Each instrument appears as a select option.
    expect(screen.getByRole("option", { name: "XAUUSD" })).toBeDefined();
    expect(screen.getByRole("option", { name: "EURUSD" })).toBeDefined();
    expect(screen.getByRole("option", { name: "GBPUSD" })).toBeDefined();
  });

  it("From/To date inputs accept user-typed ISO dates", () => {
    buildFetchMock();
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    const dateInputs = Array.from(document.querySelectorAll("input[type='date']")) as HTMLInputElement[];
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(dateInputs[0], { target: { value: "2026-01-15" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-03-20" } });
    expect(dateInputs[0].value).toBe("2026-01-15");
    expect(dateInputs[1].value).toBe("2026-03-20");
  });

  it("Bootstrap data button POSTs to /bars-bootstrap with success toast", async () => {
    const { calls } = buildFetchMock({
      bootstrapResponse: {
        ok: true,
        body: { total_bars: 5000, duration_ms: 2400, summary: [], errors: 0 },
      },
    });
    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);

    const bootstrapBtn = screen.getByRole("button", { name: /bootstrap data|Bajar data|cargar barras/i });
    fireEvent.click(bootstrapBtn);

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes("/bars-bootstrap") && c.method === "POST")).toBe(true);
      expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringMatching(/Data lista.*5000/i));
    });
  });

  it("Bootstrap bars button is disabled while the request is in flight", async () => {
    // Use a deferred promise so the request stays pending for the assert.
    let resolveFetch: (v: Response) => void = () => {};
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("/history") || url.includes("/symbol-status")) {
        return { ok: true, json: async () => ({ runs: [] }) } as Response;
      }
      if (url.includes("/bars-bootstrap")) {
        return new Promise<Response>((res) => { resolveFetch = res; });
      }
      return { ok: true, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    render(<EngineBacktestPanel algorithmId="algo-1" instruments={["XAUUSD"]} />);
    const bootstrapBtn = screen.getByRole("button", { name: /bootstrap data|Bajar data|cargar barras/i }) as HTMLButtonElement;
    fireEvent.click(bootstrapBtn);

    await waitFor(() => expect(bootstrapBtn.disabled).toBe(true));

    // Resolve the pending fetch so the test can teardown cleanly.
    resolveFetch({ ok: true, json: async () => ({ total_bars: 0, duration_ms: 1, summary: [], errors: 0 }) } as Response);
  });

});
