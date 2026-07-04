// @vitest-environment jsdom
//
// PortfolioAllocationPanel — valida:
//   1. Estado vacío (sin asignación vigente) muestra el mensaje explicativo.
//   2. Estado con datos muestra nombre + % + market_type color-coded.
//   3. Estado de error muestra el mensaje.
//   4. Toggle de historial: carga y muestra corridas pasadas, colapsa sin refetch.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("toggle de historial: carga corridas pasadas al abrir, no refetchea al reabrir", async () => {
    const historyCalls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url === "/api/portfolio/allocations") {
        return {
          ok: true,
          json: async () => ({
            allocations: [{ algorithmId: "a1", algorithmName: "ES Momentum", marketType: "futures", weight: 1, dailyReturnStdev: null }],
            runAt: "2026-07-06T04:00:00Z",
            lookbackDays: 60,
          }),
        } as Response;
      }
      historyCalls.push(url);
      return {
        ok: true,
        json: async () => ({
          runs: [
            {
              runAt: "2026-06-29T04:00:00Z",
              lookbackDays: 60,
              allocations: [{ algorithmId: "a1", algorithmName: "ES Momentum", weight: 0.5 }],
            },
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    render(<PortfolioAllocationPanel />);
    await screen.findByText(/ES Momentum/i);

    const toggle = screen.getByText(/Ver historial de corridas/i);
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(historyCalls).toEqual(["/api/portfolio/allocations/history"]);
    });
    expect(await screen.findByText(/50\.0%/)).toBeDefined();

    // Colapsar y reabrir no debe volver a pedir el historial (ya está cacheado).
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(historyCalls).toHaveLength(1);
    });
  });
});
