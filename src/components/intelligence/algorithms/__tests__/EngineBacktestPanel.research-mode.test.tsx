// @vitest-environment jsdom
//
// Research mode = algorithm has no linked_bot_account_id. The panel surfaces
// a banner with one-tap capital presets and a "Guardar como default" link.
// Validates the visibility rules, prefill from defaultBacktestBalance, preset
// clicks and the PUT to /api/algorithms/[id] when saving the default.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EngineBacktestPanel } from "../EngineBacktestPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));
vi.mock("../EquityCurve", () => ({ EquityCurve: () => null }));
vi.mock("../Mt5BarsImport.client", () => ({ Mt5BarsImport: () => null }));

function buildSilentFetchMock() {
  // History + symbol-status endpoints are polled on mount — return empty 200s
  // so the panel renders without spurious errors. PUT to /api/algorithms/[id]
  // gets captured by the test that needs it.
  return vi.fn(async (url: string) => {
    if (url.includes("/history") || url.includes("/symbol-status")) {
      return { ok: true, json: async () => ({ runs: [] }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
}

describe("EngineBacktestPanel — research mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does NOT render the research banner when the algorithm has a linked account", () => {
    globalThis.fetch = buildSilentFetchMock() as unknown as typeof fetch;
    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId="acc-uuid"
      />,
    );
    expect(screen.queryByText(/Modo research/i)).toBeNull();
  });

  it("renders the research banner when linkedBotAccountId is null", () => {
    globalThis.fetch = buildSilentFetchMock() as unknown as typeof fetch;
    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId={null}
      />,
    );
    expect(screen.getByText(/Modo research/i)).toBeDefined();
    expect(screen.getByText(/Capital inicial/i)).toBeDefined();
  });

  it("prefills the capital input with defaultBacktestBalance when provided", () => {
    globalThis.fetch = buildSilentFetchMock() as unknown as typeof fetch;
    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId={null}
        defaultBacktestBalance={50_000}
      />,
    );
    // Both the banner and the grid input share state. The banner has
    // a number input; queryByDisplayValue finds it.
    const inputs = screen.getAllByDisplayValue("50000");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("falls back to 10000 when defaultBacktestBalance is null", () => {
    globalThis.fetch = buildSilentFetchMock() as unknown as typeof fetch;
    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId={null}
        defaultBacktestBalance={null}
      />,
    );
    const inputs = screen.getAllByDisplayValue("10000");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("changes the capital when a preset is clicked", () => {
    globalThis.fetch = buildSilentFetchMock() as unknown as typeof fetch;
    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId={null}
      />,
    );
    // Default is $10K; click $100K preset.
    const preset100k = screen.getByRole("button", { name: "$100K" });
    fireEvent.click(preset100k);
    const inputs = screen.getAllByDisplayValue("100000");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("PUTs /api/algorithms/[id] when 'Guardar como default' is clicked", async () => {
    const captures: { url: string; body: unknown }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.body) captures.push({ url, body: JSON.parse(init.body as string) });
      if (url.includes("/history") || url.includes("/symbol-status")) {
        return { ok: true, json: async () => ({ runs: [] }) } as Response;
      }
      return { ok: true, json: async () => ({ algorithm: { id: "algo-1", default_backtest_balance: 100_000 } }) } as Response;
    }) as unknown as typeof fetch;

    render(
      <EngineBacktestPanel
        algorithmId="algo-1"
        instruments={["XAUUSD"]}
        linkedBotAccountId={null}
        // null default -> save link must appear once the user enters/changes any value
      />,
    );

    // Move to $100K so the save link surfaces.
    fireEvent.click(screen.getByRole("button", { name: "$100K" }));

    const save = screen.getByRole("button", { name: /Guardar como default/i });
    fireEvent.click(save);

    await waitFor(() => {
      const putCalls = captures.filter((c) => c.url === "/api/algorithms/algo-1");
      expect(putCalls.length).toBe(1);
      expect(putCalls[0].body).toEqual({ default_backtest_balance: 100_000 });
    });
  });
});
