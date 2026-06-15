// @vitest-environment jsdom
//
// UmbralPanel — withdrawal balance threshold editor por cuenta.
// Renderiza Card por cada account con balance, threshold (editable inline)
// y badge según estado (Evaluation Phase / Eligible / Need more).
//
// Validates:
//   1. Renderiza una Card por account con nombre + currentBalance formatted.
//   2. Threshold rendered como currency cuando NO editing.
//   3. Click "Edit" abre input editable inline; Save/Cancel buttons visibles.
//   4. Save success: PUT a /api/treasury/configs con body correcto;
//      toast.success + cierra el editor.
//   5. Save failure (non-ok): toast.error("No se pudo guardar el umbral").
//   6. Save con valor inválido (NaN / negativo): toast.error sin fetch.
//   7. Escape key cancela edición (cierra input).
//   8. Badge "Evaluation Phase" cuando phase_status contiene 'fase'.
//   9. Badge "Eligible for Withdrawal" cuando balance >= threshold.
//   10. Badge "Need X more" cuando balance < threshold.
//   11. Edit button oculto cuando isReadOnly=true.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(), toastErrorMock: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, message: vi.fn() },
}));

// Mocks for UI primitives — slot-through.
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

import UmbralPanel from "../Umbral.client";
import type { Account, TreasuryConfig } from "@/lib/treasury/calculations";

const ACC_FUNDED: Account = {
  id: "a1", name: "Funded $100k", account_size: 100000,
  current_balance: 105000, phase_status: "funded", withdrawals_enabled: true,
};
const ACC_EVAL: Account = {
  id: "a2", name: "FTMO eval", account_size: 50000,
  current_balance: 48000, phase_status: "fase evaluacion", withdrawals_enabled: false,
};
const ACC_NEEDS_MORE: Account = {
  id: "a3", name: "Funded $25k", account_size: 25000,
  current_balance: 24500, phase_status: "funded", withdrawals_enabled: true,
};

const CFG_FUNDED: TreasuryConfig = {
  id: "cfg-1", account_id: "a1", withdrawal_day: 15, split_mode: "growth",
  balance_threshold: 100000, anti_drawdown_active: false, anti_drawdown_threshold: 20,
  tax_buffer_percentage: 30, tax_buffer_accumulated: 0, milestone_bonus_vault: 0,
};
const CFG_NEEDS_MORE: TreasuryConfig = {
  id: "cfg-2", account_id: "a3", withdrawal_day: 15, split_mode: "growth",
  balance_threshold: 25000, anti_drawdown_active: false, anti_drawdown_threshold: 20,
  tax_buffer_percentage: 30, tax_buffer_accumulated: 0, milestone_bonus_vault: 0,
};

describe("UmbralPanel", () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("Renderiza Card por account con nombre + balance formatted", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    expect(screen.getByText("Funded $100k")).toBeDefined();
    // formatCurrency default decimals=0 → "$105,000"
    expect(screen.getByText("$105,000")).toBeDefined();
  });

  it("Threshold rendered como currency cuando NO editing", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    expect(screen.getByText("$100,000")).toBeDefined();
  });

  it("Click 'Edit' abre input editable inline + Save/Cancel buttons", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));

    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe("100000");
    expect(screen.getByLabelText(/Save/i)).toBeDefined();
    expect(screen.getByLabelText(/Cancel/i)).toBeDefined();
  });

  it("Save success: PUT a /api/treasury/configs con body correcto + toast.success", async () => {
    const onChange = vi.fn();
    const newConfig = { ...CFG_FUNDED, balance_threshold: 95000 };

    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ config: newConfig }) } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} onConfigsChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "95000" } });
    fireEvent.click(screen.getByLabelText(/Save/i));

    await waitFor(() => {
      expect(capturedInit?.method).toBe("PUT");
      const body = JSON.parse(capturedInit?.body as string);
      expect(body).toEqual({ account_id: "a1", balance_threshold: 95000 });
      expect(toastSuccessMock).toHaveBeenCalledWith("Umbral actualizado");
      expect(onChange).toHaveBeenCalled();
    });
  });

  it("Save failure (non-ok): toast.error('No se pudo guardar el umbral')", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 } as Response)) as unknown as typeof fetch;

    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "95000" } });
    fireEvent.click(screen.getByLabelText(/Save/i));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("No se pudo guardar el umbral");
    });
  });

  it("Save con valor inválido (negativo): toast.error sin fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "-100" } });
    fireEvent.click(screen.getByLabelText(/Save/i));

    expect(toastErrorMock).toHaveBeenCalledWith("Valor inválido");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Save con NaN (texto no numérico): toast.error sin fetch", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "abc" } });
    fireEvent.click(screen.getByLabelText(/Save/i));

    expect(toastErrorMock).toHaveBeenCalledWith("Valor inválido");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("Escape key cancela edición (cierra el input)", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    const input = screen.getByRole("spinbutton");
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("$100,000")).toBeDefined();
  });

  it("Badge 'Evaluation Phase' cuando phase_status contiene 'fase'", () => {
    render(<UmbralPanel accounts={[ACC_EVAL]} configs={[]} />);
    expect(screen.getByText(/Evaluation Phase/i)).toBeDefined();
  });

  it("Badge 'Eligible for Withdrawal' cuando balance >= threshold", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    expect(screen.getByText(/Eligible for Withdrawal/i)).toBeDefined();
  });

  it("Badge 'Need X more' cuando balance < threshold (sin eval)", () => {
    render(<UmbralPanel accounts={[ACC_NEEDS_MORE]} configs={[CFG_NEEDS_MORE]} />);
    // 25000 - 24500 = $500 more needed (decimals=0). Text spans the badge
    // span across siblings, so match by partial substring on any node that
    // is the badge span (its textContent contains "Need", "$500" and "more").
    const matches = screen.getAllByText((_, node) => {
      const t = node?.textContent ?? "";
      return t.includes("Need") && t.includes("$500") && t.includes("more");
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it("Edit button oculto cuando isReadOnly=true", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} isReadOnly />);
    expect(screen.queryByRole("button", { name: /Edit/i })).toBeNull();
    // Threshold value sigue visible
    expect(screen.getByText("$100,000")).toBeDefined();
  });

  it("Enter key triggers saveThreshold", async () => {
    const newConfig = { ...CFG_FUNDED, balance_threshold: 50000 };
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ config: newConfig }) } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[CFG_FUNDED]} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit/i }));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "50000" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(capturedInit?.method).toBe("PUT");
      const body = JSON.parse(capturedInit?.body as string);
      expect(body.balance_threshold).toBe(50000);
    });
  });

  it("Threshold = 0 cuando NO hay config para la account", () => {
    render(<UmbralPanel accounts={[ACC_FUNDED]} configs={[]} />);
    // 105000 >= 0 → Eligible
    expect(screen.getByText(/Eligible for Withdrawal/i)).toBeDefined();
  });
});
