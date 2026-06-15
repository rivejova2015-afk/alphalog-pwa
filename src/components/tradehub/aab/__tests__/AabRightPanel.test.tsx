// @vitest-environment jsdom
//
// AAB Fase 1 hygiene — AabRightPanel now uses Sonner toasts (instead of an
// inline error <div>) and a ConfirmDialog (instead of native window.confirm)
// for the destructive rollback. These tests lock in that behavior.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import AabRightPanel from "../AabRightPanel.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const group = { id: "g1", name: "Grupo 1", active_version: 2, sync_mode: "hard" as const };
const accounts = [
  { id: "a1", name: "Cuenta 1", currency: "USD", status: "active", operation_state: null, phase_status: null, role: null },
];
const versions = [
  { id: "v1", version_int: 1, message: "init", created_at: "2026-06-01T00:00:00.000Z" },
];

function renderPanel(onReload = vi.fn()) {
  return render(
    <AabRightPanel
      group={group}
      nodes={[]}
      links={[]}
      versions={versions}
      events={[]}
      experiments={{}}
      accounts={accounts}
      selectedNode={null}
      onReload={onReload}
      onSelectNode={vi.fn()}
      experimentFlags={[]}
    />
  );
}

describe("AabRightPanel — Fase 1 hygiene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("muestra toast.success y recarga al agregar un nodo con éxito", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ id: "n1" }) })));
    const onReload = vi.fn();
    renderPanel(onReload);

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar nodo" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nodo agregado"));
    expect(onReload).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("muestra toast.error con el mensaje del backend si falla", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({ error: "límite alcanzado" }) })));
    renderPanel();

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar nodo" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("límite alcanzado"));
  });

  it("pide confirmación vía ConfirmDialog antes del rollback (no window.confirm)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    // Click Rollback → no fetch todavía, aparece el diálogo de confirmación.
    fireEvent.click(screen.getByRole("button", { name: "Rollback" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/¿Aplicar rollback a v1\?/)).toBeInTheDocument();

    // Confirmar → recién ahí pega al endpoint y muestra success.
    fireEvent.click(screen.getByRole("button", { name: "Aplicar rollback" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/copy-groups/g1/rollback",
      expect.objectContaining({ method: "POST" })
    ));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rollback a v1 aplicado"));
  });
});
