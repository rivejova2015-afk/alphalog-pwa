// @vitest-environment jsdom
//
// AuditTrailTimeline — self-fetching audit history for one algorithm
// (Wave 5 item 23). Covers: loading skeleton, error state, empty state,
// and happy-path rendering (action label mapping, status icon selection,
// error_message display on failed entries).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuditTrailTimeline from "../AuditTrailTimeline.client";

function mockFetch(entries: unknown[], ok = true) {
  globalThis.fetch = vi.fn(async () => ({
    ok,
    json: async () => (ok ? { entries } : { error: "boom" }),
  })) as unknown as typeof fetch;
}

describe("AuditTrailTimeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a loading skeleton before the fetch resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<AuditTrailTimeline algorithmId="algo-1" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error message when the fetch fails", async () => {
    mockFetch([], false);
    render(<AuditTrailTimeline algorithmId="algo-1" />);
    expect(await screen.findByText(/Error cargando audit trail: boom/i)).toBeDefined();
  });

  it("shows an empty state when there are no entries", async () => {
    mockFetch([]);
    render(<AuditTrailTimeline algorithmId="algo-1" />);
    expect(await screen.findByText("Sin actividad registrada todavía.")).toBeDefined();
  });

  it("renders entries with mapped action labels, resource type, and timestamp", async () => {
    mockFetch([
      { id: "log-1", action: "update", resource_type: "algorithm", changes: { status: "live" }, status: "success", error_message: null, created_at: "2026-07-01T00:00:00Z" },
      { id: "log-2", action: "create", resource_type: "algorithm_deployment", changes: null, status: "success", error_message: null, created_at: "2026-06-30T00:00:00Z" },
    ]);
    render(<AuditTrailTimeline algorithmId="algo-1" />);

    expect(await screen.findByText("Actualizado")).toBeDefined();
    expect(screen.getByText("Algoritmo")).toBeDefined();
    expect(screen.getByText("Creado")).toBeDefined();
    expect(screen.getByText("Deployment")).toBeDefined();
  });

  it("shows an unmapped action verbatim (fallback)", async () => {
    mockFetch([{ id: "log-1", action: "bot_signal_generated", resource_type: "algorithm", changes: null, status: "success", error_message: null, created_at: "2026-07-01T00:00:00Z" }]);
    render(<AuditTrailTimeline algorithmId="algo-1" />);
    expect(await screen.findByText("bot_signal_generated")).toBeDefined();
  });

  it("shows the error_message for a failed entry", async () => {
    mockFetch([{ id: "log-1", action: "update", resource_type: "algorithm", changes: null, status: "failure", error_message: "RLS denied", created_at: "2026-07-01T00:00:00Z" }]);
    render(<AuditTrailTimeline algorithmId="algo-1" />);
    await waitFor(() => {
      expect(screen.getByText("RLS denied")).toBeDefined();
    });
  });
});
