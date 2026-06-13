// @vitest-environment jsdom
//
// AlgorithmShadowInbox — client component que muestra el historial de
// cme_signals para un algoritmo. Validates:
//   1. Loading state initial → spinner "Cargando signals…".
//   2. Empty state cuando la API retorna [] → mensaje "Sin signals todavía".
//   3. Error state cuando fetch falla → mensaje "Error: ...".
//   4. Render tabla con signals (relative time, direction color, status icon).
//   5. Filter buttons cambian el query param status= y re-fetch.
//   6. Stats footer cuenta BUY/SELL de últimos 7d.
//   7. Hint "DISPATCH_MODE=live" aparece sólo cuando TODOS los signals son
//      shadow_mode skipped (señal de readiness para flip).
//   8. Stats NO incluyen signals fuera de la ventana 7d.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AlgorithmShadowInbox } from "../AlgorithmShadowInbox.client";

function mockFetch(signals: unknown[], ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ signals }),
  }) as unknown as typeof fetch;
}

const baseSignal = {
  id:                "sig-1",
  algorithm_id:      "algo-1",
  cme_account_id:    "cme-1",
  contract:          "ESM5",
  direction:         "BUY" as const,
  signal_type:       "entry" as const,
  quantity:          2,
  stop_loss_ticks:   20,
  take_profit_ticks: 40,
  status:            "skipped" as const,
  reject_reason:     "shadow_mode",
  created_at:        new Date().toISOString(),
  executed_at:       null,
};

describe("AlgorithmShadowInbox", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the loading state initially", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    expect(screen.getByText(/Cargando signals/i)).toBeDefined();
  });

  it("renders empty state when API returns no signals", async () => {
    mockFetch([]);
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Sin signals todavía/i)).toBeDefined();
    });
  });

  it("renders error state when the API returns non-2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "Internal boom" }),
    }) as unknown as typeof fetch;
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Error.*Internal boom/i)).toBeDefined();
    });
  });

  it("renders signal rows + stats footer counts BUY/SELL", async () => {
    mockFetch([
      { ...baseSignal, id: "s1", direction: "BUY"  },
      { ...baseSignal, id: "s2", direction: "BUY"  },
      { ...baseSignal, id: "s3", direction: "SELL" },
    ]);
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);

    await waitFor(() => {
      // Stats footer.
      expect(screen.getByText(/3 en últimos 7d.*2 BUY.*1 SELL/i)).toBeDefined();
    });
    // Contract label appears in every row.
    expect(screen.getAllByText("ESM5").length).toBe(3);
  });

  it("renders the DISPATCH_MODE=live hint when ALL signals are shadow_mode", async () => {
    mockFetch([
      { ...baseSignal, id: "s1", status: "skipped", reject_reason: "shadow_mode" },
      { ...baseSignal, id: "s2", status: "skipped", reject_reason: "shadow_mode" },
    ]);
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Los últimos 2 signals son shadow_mode/i)).toBeDefined();
    });
    expect(screen.getByText(/DISPATCH_MODE=live/)).toBeDefined();
  });

  it("does NOT render the live-hint when at least one signal is executed", async () => {
    mockFetch([
      { ...baseSignal, id: "s1", status: "skipped",  reject_reason: "shadow_mode" },
      { ...baseSignal, id: "s2", status: "executed", reject_reason: null },
    ]);
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText(/2 en últimos 7d/i)).toBeDefined();
    });
    expect(screen.queryByText(/Los últimos.*signals son shadow_mode/i)).toBeNull();
  });

  it("filter button click adds status= query param and re-fetches", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string) => {
      calls.push(url);
      return {
        ok: true, status: 200,
        json: async () => ({ signals: [] }),
      };
    }) as unknown as typeof fetch;

    render(<AlgorithmShadowInbox algorithmId="algo-1" />);

    // Initial fetch: no status filter.
    await waitFor(() => {
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
    expect(calls[0]).not.toContain("status=");

    // Click "Ejecutados" filter.
    fireEvent.click(screen.getByRole("button", { name: /Ejecutados/i }));

    await waitFor(() => {
      expect(calls.some((u) => u.includes("status=executed"))).toBe(true);
    });
  });

  it("excludes signals older than 7 days from the stats counters", async () => {
    const oldIso = new Date(Date.now() - 10 * 86_400_000).toISOString();
    mockFetch([
      { ...baseSignal, id: "old", direction: "BUY", created_at: oldIso },
      { ...baseSignal, id: "new", direction: "SELL" },
    ]);
    render(<AlgorithmShadowInbox algorithmId="algo-1" />);
    await waitFor(() => {
      // Old signal excluded → "1 en últimos 7d" with "0 BUY · 1 SELL".
      expect(screen.getByText(/1 en últimos 7d.*0 BUY.*1 SELL/i)).toBeDefined();
    });
  });
});
