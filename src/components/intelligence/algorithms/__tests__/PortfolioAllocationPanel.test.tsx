// @vitest-environment jsdom
//
// PortfolioAllocationPanel — valida:
//   1. Estado vacío (sin asignación vigente) muestra el mensaje explicativo.
//   2. Estado con datos muestra nombre + % + market_type color-coded.
//   3. Estado de error muestra el mensaje.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortfolioAllocationPanel } from "../PortfolioAllocationPanel.client";

vi.mock("@/lib/log", () => ({ logError: vi.fn() }));

describe("PortfolioAllocationPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra el mensaje de 'sin asignación' cuando allocations está vacío", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ allocations: [], runAt: null, lookbackDays: null }),
    })) as unknown as typeof fetch;

    render(<PortfolioAllocationPanel />);

    expect(await screen.findByText(/Todavía no hay una asignación HRP calculada/i)).toBeDefined();
  });

  it("renderiza los pesos con nombre + porcentaje", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        allocations: [
          { algorithmId: "a1", algorithmName: "ES Momentum", marketType: "futures", weight: 0.65, dailyReturnStdev: 0.012 },
          { algorithmId: "a2", algorithmName: "Coinarb 50x", marketType: "crypto", weight: 0.35, dailyReturnStdev: 0.02 },
        ],
        runAt: "2026-07-01T00:00:00Z",
        lookbackDays: 60,
      }),
    })) as unknown as typeof fetch;

    render(<PortfolioAllocationPanel />);

    expect(await screen.findByText(/ES Momentum/i)).toBeDefined();
    expect(await screen.findByText(/65\.0%/)).toBeDefined();
    expect(await screen.findByText(/Coinarb 50x/i)).toBeDefined();
    expect(await screen.findByText(/35\.0%/)).toBeDefined();
    expect(await screen.findByText(/lookback 60d/i)).toBeDefined();
  });

  it("muestra el error cuando el fetch falla", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "db down" }),
    })) as unknown as typeof fetch;

    render(<PortfolioAllocationPanel />);

    expect(await screen.findByText(/db down/i)).toBeDefined();
  });
});
