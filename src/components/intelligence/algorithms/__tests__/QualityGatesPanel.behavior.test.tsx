// @vitest-environment jsdom
//
// QualityGatesPanel — behavior coverage that complements the existing tier
// + promote tests in this folder. Validates:
//   1. Loading message while initial fetch is pending.
//   2. Error toast when initial fetch errors out + "No se pudo cargar" panel.
//   3. Category sections render with "X/Y" passed counter.
//   4. Category section toggles between expanded ▾ and collapsed ▸ via click.
//   5. Recompute click POSTs to /recompute and re-fetches, toast success.
//   6. Promote click without confirm → no fetch (user cancelled).
//   7. Promote click WITH confirm → POSTs to /promote-to-live, success toast.
//   8. Promote 403 response → extracts failed gate keys into the error toast.
//   9. Individual gate row shows the observed value + threshold suffix.
//  10. Gate row shows reason when present, description when reason is null.
//  11. last_computed_at timestamp rendered when set.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock:   vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: toastSuccessMock, info: vi.fn(), message: vi.fn(), warning: vi.fn() },
}));

import QualityGatesPanel from "../QualityGatesPanel.client";

// Helper builders for the API response shape.
function gate(over: Partial<{
  gate_key: string; name: string; category: "edge" | "capital" | "micro" | "ops";
  severity: "must" | "should"; passed: boolean | null; value_observed: number | null;
  unit: string | null; threshold_op: string; threshold_value: number;
  description: string; reason: string | null;
}> = {}) {
  return {
    gate_key:        over.gate_key       ?? "g1",
    name:            over.name           ?? "Gate 1",
    category:        over.category       ?? ("edge" as const),
    severity:        over.severity       ?? ("must" as const),
    threshold_op:    over.threshold_op   ?? ">=",
    threshold_value: over.threshold_value ?? 1,
    unit:            over.unit ?? null,
    description:     over.description    ?? "Generic description",
    passed:          over.passed ?? null,
    value_observed:  over.value_observed ?? null,
    reason:          over.reason ?? null,
    computed_at:     null,
  };
}

function fullResponse(over: Partial<{ tier: "TIER_1" | "TIER_2" | "NOT_READY"; gates_passed: number; must_failed: number; should_failed: number; last_computed_at: string | null; breakdown: ReturnType<typeof gate>[] }> = {}) {
  return {
    algorithm: { id: "a", name: "x", status: "approved" },
    score: {
      algorithm_id:     "a",
      gates_total:      20,
      gates_passed:     over.gates_passed ?? 20,
      must_failed:      over.must_failed ?? 0,
      should_failed:    over.should_failed ?? 0,
      last_computed_at: over.last_computed_at ?? null,
      tier:             over.tier ?? "TIER_1",
    },
    breakdown: over.breakdown ?? [
      gate({ gate_key: "edge_1",    category: "edge",    passed: true }),
      gate({ gate_key: "capital_1", category: "capital", passed: true }),
      gate({ gate_key: "micro_1",   category: "micro",   passed: true }),
      gate({ gate_key: "ops_1",     category: "ops",     passed: true }),
    ],
  };
}

describe("QualityGatesPanel — behavior coverage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  afterEach(() => cleanup());

  it("shows the loading state while the initial fetch is pending", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);
    expect(screen.getByText(/Cargando quality gates/i)).toBeDefined();
  });

  it("shows 'No se pudo cargar' + error toast when initial fetch fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: "boom" }),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("boom");
    });
    expect(screen.getByText(/No se pudo cargar/i)).toBeDefined();
  });

  it("renders 4 category sections with 'X/Y' passed counters", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => fullResponse(),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => {
      expect(screen.getByText(/Edge/i)).toBeDefined();
    });
    expect(screen.getByText(/Capital/i)).toBeDefined();
    expect(screen.getByText(/Microstructure/i)).toBeDefined();
    expect(screen.getByText(/Operations/i)).toBeDefined();
    expect(screen.getAllByText(/\(1\/1\)/).length).toBe(4);
  });

  it("category headers toggle aria-expanded on click", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => fullResponse(),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => {
      expect(screen.getByText(/Edge/i)).toBeDefined();
    });
    const edgeButton = screen.getByText(/Edge/i).closest("button")!;
    expect(edgeButton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(edgeButton);
    expect(edgeButton.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(edgeButton);
    expect(edgeButton.getAttribute("aria-expanded")).toBe("true");
  });

  it("Recompute click POSTs to /recompute and emits a success toast", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/recompute")) {
        return {
          ok: true, status: 200,
          json: async () => ({ score: { gates_passed: 20, gates_total: 20, tier: "TIER_1" } }),
        };
      }
      return { ok: true, status: 200, json: async () => fullResponse() };
    }) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="a" />);
    await waitFor(() => screen.getByRole("button", { name: /Recompute/i }));
    fireEvent.click(screen.getByRole("button", { name: /Recompute/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(expect.stringMatching(/Score: 20\/20.*TIER_1/));
    });
    const recomputeCall = calls.find((c) => c.url.endsWith("/recompute"));
    expect(recomputeCall?.init?.method).toBe("POST");
  });

  it("Promote click: confirm=false → no POST", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => fullResponse(),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="a" />);
    await waitFor(() => screen.getByRole("button", { name: /Promover a LIVE/i }));
    fireEvent.click(screen.getByRole("button", { name: /Promover a LIVE/i }));

    // Only the initial GET to /quality-gates fired — no /promote-to-live POST.
    await new Promise((r) => setTimeout(r, 10));
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/promote-to-live"))).toBe(false);
  });

  it("Promote click: 403 response extracts failed gate keys into error toast", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("/promote-to-live")) {
        return {
          ok: false, status: 403,
          json: async () => ({
            error: "Tier-1 quality gates not passed",
            failed: [{ gate_key: "min_trades" }, { gate_key: "sharpe" }],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => fullResponse() };
    }) as unknown as typeof fetch;

    render(<QualityGatesPanel algorithmId="a" />);
    await waitFor(() => screen.getByRole("button", { name: /Promover a LIVE/i }));
    fireEvent.click(screen.getByRole("button", { name: /Promover a LIVE/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.stringMatching(/Bloqueado por gates.*min_trades.*sharpe/i),
      );
    });
  });

  it("gate row renders observed value with threshold suffix", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => fullResponse({
        breakdown: [
          gate({
            gate_key: "sharpe", name: "Sharpe",
            category: "edge", passed: false,
            value_observed: 0.5, unit: null,
            threshold_op: ">=", threshold_value: 1,
            reason: "Sharpe muy bajo",
          }),
          gate({ gate_key: "c1", category: "capital", passed: true }),
          gate({ gate_key: "m1", category: "micro",   passed: true }),
          gate({ gate_key: "o1", category: "ops",     passed: true }),
        ],
        gates_passed: 3, must_failed: 1, tier: "NOT_READY",
      }),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => screen.getByText("Sharpe"));
    expect(screen.getByText(/obs:/)).toBeDefined();
    expect(screen.getByText(/0\.5/)).toBeDefined();
    expect(screen.getByText(/thr >= 1/)).toBeDefined();
    expect(screen.getByText(/Sharpe muy bajo/)).toBeDefined();
  });

  it("gate row falls back to description when reason is null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => fullResponse({
        breakdown: [
          gate({ gate_key: "g1", category: "edge", passed: true, description: "Edge has a meaningful Sharpe ratio" }),
          gate({ gate_key: "c1", category: "capital", passed: true }),
          gate({ gate_key: "m1", category: "micro",   passed: true }),
          gate({ gate_key: "o1", category: "ops",     passed: true }),
        ],
      }),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => screen.getByText(/Edge has a meaningful Sharpe ratio/i));
  });

  it("renders the last_computed_at timestamp when set", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => fullResponse({ last_computed_at: "2026-06-12T10:00:00Z" }),
    }) as unknown as typeof fetch;
    render(<QualityGatesPanel algorithmId="a" />);

    await waitFor(() => {
      expect(screen.getByText(/Último compute:/i)).toBeDefined();
    });
  });
});
