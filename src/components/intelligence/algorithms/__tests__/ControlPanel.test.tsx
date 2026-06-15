// @vitest-environment jsdom
//
// ControlPanel — accordion con status toggle + 5 sliders + save/reset.
// Validates:
//   1. Header collapsed por default; click expande.
//   2. Status='ACTIVE' renderiza "Pause Strategy"; 'PAUSED' renderiza
//      "Resume Strategy".
//   3. Toggle status → PUT /api/algorithms/[id] con {status: 'paused'|'running'}.
//   4. onStatusChange callback se invoca con (id, nextStatus) en success.
//   5. Toast.error cuando PUT status falla.
//   6. Sliders renderizan los 5 parámetros con value + label + unit.
//   7. Slider change actualiza el value visible.
//   8. Save click → PUT con parameters object; muestra "✓ Saved".
//   9. Save error → toast.error.
//  10. Reset button regresa a defaults + limpia "✓ Saved" state.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn(), message: vi.fn() } }));

import { ControlPanel } from "../ControlPanel.client";

function buildFetchMock(response: { ok: boolean; status?: number } = { ok: true }) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const c: { url: string; method: string; body?: unknown } = { url, method: init?.method ?? "GET" };
    if (init?.body) try { c.body = JSON.parse(init.body as string); } catch { /* noop */ }
    calls.push(c);
    return { ok: response.ok, status: response.status ?? (response.ok ? 200 : 500), json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("ControlPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
  });

  it("starts collapsed and expands on header click", () => {
    render(<ControlPanel algoId="a1" algoName="Test algo" status="PAUSED" />);
    expect(screen.queryByText(/Resume Strategy/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/Resume Strategy/i)).toBeDefined();
  });

  it("renders 'Pause Strategy' button for ACTIVE status", () => {
    render(<ControlPanel algoId="a1" algoName="X" status="ACTIVE" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/Pause Strategy/i)).toBeDefined();
    expect(screen.queryByText(/Resume Strategy/i)).toBeNull();
  });

  it("toggle PUTs status=paused when transitioning from ACTIVE + invokes onStatusChange", async () => {
    const calls = buildFetchMock();
    const onStatusChange = vi.fn();
    render(<ControlPanel algoId="a1" algoName="X" status="ACTIVE" onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Pause Strategy/i));

    await waitFor(() => {
      const put = calls.find((c) => c.url === "/api/algorithms/a1" && c.method === "PUT");
      expect(put).toBeDefined();
      expect((put!.body as { status: string }).status).toBe("paused");
      expect(onStatusChange).toHaveBeenCalledWith("a1", "PAUSED");
    });
  });

  it("toggle PUTs status=running when transitioning from PAUSED", async () => {
    const calls = buildFetchMock();
    const onStatusChange = vi.fn();
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Resume Strategy/i));

    await waitFor(() => {
      const put = calls.find((c) => c.url === "/api/algorithms/a1" && c.method === "PUT");
      expect((put!.body as { status: string }).status).toBe("running");
      expect(onStatusChange).toHaveBeenCalledWith("a1", "ACTIVE");
    });
  });

  it("toggle status failure surfaces a toast.error and does NOT call onStatusChange", async () => {
    buildFetchMock({ ok: false });
    const onStatusChange = vi.fn();
    render(<ControlPanel algoId="a1" algoName="X" status="ACTIVE" onStatusChange={onStatusChange} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Pause Strategy/i));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/cambiar estado/i));
    });
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it("renders the 5 strategy parameters with their default values", () => {
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText("Lot Size")).toBeDefined();
    expect(screen.getByText("Stop Loss")).toBeDefined();
    expect(screen.getByText("Take Profit")).toBeDefined();
    expect(screen.getByText("Max Open Trades")).toBeDefined();
    expect(screen.getByText("Risk Per Trade")).toBeDefined();
    // Default values visible.
    expect(screen.getByText("50pips")).toBeDefined();
    expect(screen.getByText("100pips")).toBeDefined();
    expect(screen.getByText("2%")).toBeDefined();
  });

  it("slider change updates the visible parameter value", () => {
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const ranges = document.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
    // Second slider is stop_loss_pips (default 50, min 10, max 200).
    fireEvent.change(ranges[1], { target: { value: "120" } });
    expect(screen.getByText("120pips")).toBeDefined();
  });

  it("Save click PUTs parameters and flips the label to '✓ Saved'", async () => {
    const calls = buildFetchMock();
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Save Parameters/i));

    await waitFor(() => {
      const put = calls.find((c) => c.url === "/api/algorithms/a1" && c.method === "PUT");
      expect(put).toBeDefined();
      const body = put!.body as { parameters: Record<string, number> };
      expect(body.parameters).toMatchObject({
        lot_size:         0.5,
        stop_loss_pips:   50,
        take_profit_pips: 100,
        max_trades:       3,
        risk_percent:     2.0,
      });
    });
    expect(screen.getByText(/✓ Saved/i)).toBeDefined();
  });

  it("Save failure surfaces a toast.error", async () => {
    buildFetchMock({ ok: false });
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(screen.getByText(/Save Parameters/i));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(expect.stringMatching(/Error al guardar/i));
    });
  });

  it("Reset button restores defaults and clears the saved flag", async () => {
    buildFetchMock();
    render(<ControlPanel algoId="a1" algoName="X" status="PAUSED" />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));

    // Change a param + save.
    const ranges = document.querySelectorAll('input[type="range"]') as NodeListOf<HTMLInputElement>;
    fireEvent.change(ranges[1], { target: { value: "180" } });
    fireEvent.click(screen.getByText(/Save Parameters/i));
    await waitFor(() => screen.getByText(/✓ Saved/i));

    // Reset button — there's only one icon-only button with title 'Reset to defaults'.
    const resetBtn = screen.getByTitle(/Reset to defaults/i);
    fireEvent.click(resetBtn);

    // Saved flag cleared (button label flips back to 'Save Parameters').
    expect(screen.getByText(/Save Parameters/i)).toBeDefined();
    // Default value restored.
    expect(screen.getByText("50pips")).toBeDefined();
    expect(screen.queryByText("180pips")).toBeNull();
  });
});
