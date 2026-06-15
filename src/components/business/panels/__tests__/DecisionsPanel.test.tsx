// @vitest-environment jsdom
//
// DecisionsPanel — strategic decisions CRUD con expand→tasks, add task modal,
// confirm-delete modal.
//
// Validates:
//   1. "Loading decisions..." durante load.
//   2. EmptyState cuando data array vacío.
//   3. Renderiza title + decision text + priority badge cuando hay items.
//   4. New Decision button oculto cuando isReadOnly=true.
//   5. Click "Tasks" expande y llama loadDecisionTasks; aria-expanded=true.
//   6. Click delete abre confirm modal con role="dialog" + aria-modal.
//   7. handleDelete success: invoca deleteBusinessDecision + toast.success.
//   8. handleDelete failure: toast.error + logError.
//   9. Add task modal abre con role="dialog" aria-label="Add task";
//      disabled cuando input vacío; Enter submits.
//   10. handleAddTask hace POST a /api/business/decisions/{id}/tasks con CSRF.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const {
  loadDecisionsMock, loadTasksMock, deleteDecisionMock,
  getSopWithTasksMock, toastSuccessMock, toastErrorMock, logErrorMock,
} = vi.hoisted(() => ({
  loadDecisionsMock:    vi.fn(),
  loadTasksMock:        vi.fn(),
  deleteDecisionMock:   vi.fn(),
  getSopWithTasksMock:  vi.fn(),
  toastSuccessMock:     vi.fn(),
  toastErrorMock:       vi.fn(),
  logErrorMock:         vi.fn(),
}));

vi.mock("@/lib/business/offline-loader", () => ({
  loadBusinessDecisions:     loadDecisionsMock,
  loadBusinessDecisionTasks: loadTasksMock,
}));
vi.mock("@/lib/business/queries", () => ({
  deleteBusinessDecision:     deleteDecisionMock,
  getBusinessDecisionWithTasks: getSopWithTasksMock,
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, message: vi.fn() },
}));
vi.mock("@/lib/log", () => ({
  logError: logErrorMock, logInfo: vi.fn(), logWarn: vi.fn(),
}));
vi.mock("../../forms/DecisionForm.client", () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="decision-form">
      <button onClick={onClose}>Close form</button>
    </div>
  ),
}));

import DecisionsPanel from "../DecisionsPanel.client";

function makeDecision(over: Partial<{
  id: string; title: string; decision: string; priority: "low" | "med" | "high";
  tags: string[]; rationale: string;
}> = {}) {
  return {
    id:          over.id ?? "d1",
    user_id:     "u1",
    title:       over.title ?? "Stop trading XAUUSD",
    context:     "ctx",
    decision:    over.decision ?? "Reduce exposure to gold",
    rationale:   over.rationale ?? "Drawdown exceeded 15%",
    impact:      "High",
    tags:        over.tags ?? ["risk", "gold"],
    priority:    over.priority ?? "high",
    sort_index:  0, created_at: "", updated_at: "",
  };
}

describe("DecisionsPanel", () => {
  beforeEach(() => {
    loadDecisionsMock.mockReset();
    loadTasksMock.mockReset();
    deleteDecisionMock.mockReset();
    getSopWithTasksMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    logErrorMock.mockReset();
    Object.defineProperty(document, "cookie", {
      value: "al_csrf=tok123", writable: true, configurable: true,
    });
  });

  it("Loading state visible durante carga inicial", () => {
    loadDecisionsMock.mockReturnValue(new Promise(() => { /* never resolves */ }));
    render(<DecisionsPanel />);
    expect(screen.getByText(/Loading decisions/i)).toBeDefined();
  });

  it("Empty state cuando no hay decisions", async () => {
    loadDecisionsMock.mockResolvedValue([]);
    render(<DecisionsPanel />);
    await waitFor(() => expect(screen.getByText(/No decisions recorded yet/i)).toBeDefined());
  });

  it("Renderiza title + decision + priority badge cuando hay items", async () => {
    loadDecisionsMock.mockResolvedValue([
      makeDecision({ title: "Reduce gold exposure", decision: "Cut to 1 lot", priority: "high" }),
    ]);
    render(<DecisionsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Reduce gold exposure/i)).toBeDefined();
      expect(screen.getByText(/Cut to 1 lot/i)).toBeDefined();
      expect(screen.getByText("high")).toBeDefined();
    });
  });

  it("New Decision button oculto cuando isReadOnly=true", async () => {
    loadDecisionsMock.mockResolvedValue([]);
    render(<DecisionsPanel isReadOnly />);
    await waitFor(() => screen.getByText(/No decisions recorded yet/i));
    expect(screen.queryByRole("button", { name: /New Decision/i })).toBeNull();
  });

  it("Click 'Tasks' button expande y llama getBusinessDecisionWithTasks", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision({ id: "d1" })]);
    getSopWithTasksMock.mockResolvedValue({
      decision: { id: "d1" },
      tasks: [{ id: "t1", title: "Email broker", done: false }],
    });

    render(<DecisionsPanel />);
    await waitFor(() => screen.getByText(/Reduce exposure to gold/i));

    const tasksBtn = screen.getByRole("button", { name: /^Tasks$/ });
    fireEvent.click(tasksBtn);

    await waitFor(() => {
      expect(getSopWithTasksMock).toHaveBeenCalledWith("d1");
      expect(screen.getByText(/Email broker/i)).toBeDefined();
    });

    // aria-expanded flips to true
    expect(tasksBtn.getAttribute("aria-expanded")).toBe("true");
  });

  it("Click delete abre confirm modal con role='dialog'", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision()]);
    render(<DecisionsPanel />);
    await waitFor(() => screen.getByLabelText(/Delete decision/i));

    fireEvent.click(screen.getByLabelText(/Delete decision/i));

    const dialog = screen.getByRole("dialog", { name: /Confirm delete/i });
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText(/Delete Decision\?/i)).toBeDefined();
  });

  it("Confirm delete success → invoca deleteBusinessDecision + toast.success", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision({ id: "d1" })]);
    deleteDecisionMock.mockResolvedValue(true);
    render(<DecisionsPanel />);
    await waitFor(() => screen.getByLabelText(/Delete decision/i));

    fireEvent.click(screen.getByLabelText(/Delete decision/i));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(deleteDecisionMock).toHaveBeenCalledWith("d1");
      expect(toastSuccessMock).toHaveBeenCalledWith("Decision deleted");
    });
  });

  it("Confirm delete failure → toast.error + logError", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision({ id: "d1" })]);
    deleteDecisionMock.mockRejectedValue(new Error("network 503"));
    render(<DecisionsPanel />);
    await waitFor(() => screen.getByLabelText(/Delete decision/i));

    fireEvent.click(screen.getByLabelText(/Delete decision/i));
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete decision");
      expect(logErrorMock).toHaveBeenCalledWith(
        "DecisionsPanel",
        expect.objectContaining({ message: "Error deleting decision" }),
      );
    });
  });

  it("Add task modal: abre con dialog role + button disabled cuando input vacío", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision()]);
    render(<DecisionsPanel />);
    await waitFor(() => screen.getByLabelText(/Add follow-up task/i));

    fireEvent.click(screen.getByLabelText(/Add follow-up task/i));

    const dialog = screen.getByRole("dialog", { name: /Add task/i });
    expect(dialog).toBeDefined();
    const addBtn = screen.getByRole("button", { name: /Add Task/i }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it("handleAddTask: POST a /api/business/decisions/{id}/tasks con CSRF header", async () => {
    loadDecisionsMock.mockResolvedValue([makeDecision({ id: "d-99" })]);

    let capturedUrl  = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl  = url;
      capturedInit = init;
      return { ok: true, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    render(<DecisionsPanel />);
    await waitFor(() => screen.getByLabelText(/Add follow-up task/i));

    fireEvent.click(screen.getByLabelText(/Add follow-up task/i));

    const input = screen.getByPlaceholderText(/Task title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Schedule review" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Task/i }));

    await waitFor(() => {
      expect(capturedUrl).toBe("/api/business/decisions/d-99/tasks");
      expect(capturedInit?.method).toBe("POST");
      const headers = capturedInit?.headers as Record<string, string>;
      expect(headers["x-csrf-token"]).toBe("tok123");
      expect(headers["Content-Type"]).toBe("application/json");
      const body = JSON.parse(capturedInit?.body as string);
      expect(body).toEqual({ title: "Schedule review", done: false });
      expect(toastSuccessMock).toHaveBeenCalledWith("Task added");
    });
  });

  it("loadDecisions throw → logError pero UI continúa", async () => {
    loadDecisionsMock.mockRejectedValue(new Error("ECONNREFUSED"));
    render(<DecisionsPanel />);
    await waitFor(() => {
      expect(logErrorMock).toHaveBeenCalledWith(
        "DecisionsPanel",
        expect.objectContaining({ message: "Error loading decisions" }),
      );
    });
    // UI continues rendering (empty state)
    expect(screen.getByText(/No decisions recorded yet/i)).toBeDefined();
  });
});
