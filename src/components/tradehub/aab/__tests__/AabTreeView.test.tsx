// @vitest-environment jsdom
//
// AAB Fase 2 — DnD reorder de hermanos. jsdom no simula drag con puntero real,
// así que estos tests fijan lo verificable por render:
//   - Los hijos se ordenan por sort_index (no por el orden del array `links`).
//   - Cada slave tiene un drag handle; el master (raíz) no.
//   - La semántica ARIA del árbol se mantiene (role="tree"/"treeitem").

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AabTreeView from "../AabTreeView.client";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() } }));

const acc = (id: string, name: string) => ({
  id,
  name,
  currency: "USD",
  status: "active",
  operation_state: null,
  phase_status: null,
  role: null,
});

// master "m" with two slaves. Slave B has sort_index 0, slave A has 1, so the
// expected render order is B before A — even though links list A first.
const nodes = [
  { id: "node-m", account_id: "m", role: "master" as const, status: "active" as const, risk_pct: 0, sort_index: 0, account: acc("m", "Master") },
  { id: "node-a", account_id: "a", role: "slave" as const, status: "active" as const, risk_pct: 1, sort_index: 1, account: acc("a", "Cuenta A") },
  { id: "node-b", account_id: "b", role: "slave" as const, status: "active" as const, risk_pct: 1, sort_index: 0, account: acc("b", "Cuenta B") },
];
const links = [
  { id: "l-a", parent_account_id: "m", child_account_id: "a", copy_multiplier: 1, link_type: "solid" as const },
  { id: "l-b", parent_account_id: "m", child_account_id: "b", copy_multiplier: 1, link_type: "solid" as const },
];

function renderTree() {
  return render(
    <AabTreeView
      nodes={nodes}
      links={links}
      selectedNodeId={null}
      onSelectNode={vi.fn()}
      copyGroupId="g1"
      onReorderCommitted={vi.fn()}
    />
  );
}

describe("AabTreeView — Fase 2 reorder", () => {
  it("ordena los hijos por sort_index, no por el orden de links", () => {
    renderTree();
    const a = screen.getByText("Cuenta A");
    const b = screen.getByText("Cuenta B");
    // B (sort_index 0) debe aparecer antes que A (sort_index 1) en el DOM.
    expect(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renderiza un drag handle por cada slave, ninguno para el master", () => {
    renderTree();
    const handles = screen.getAllByLabelText(/Arrastrar para reordenar/);
    expect(handles).toHaveLength(2);
    expect(screen.queryByLabelText(/Arrastrar para reordenar Master/)).toBeNull();
  });

  it("mantiene la semántica ARIA del árbol", () => {
    renderTree();
    expect(screen.getByRole("tree")).toBeInTheDocument();
    // master + 2 slaves = 3 treeitems
    expect(screen.getAllByRole("treeitem")).toHaveLength(3);
  });
});
