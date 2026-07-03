// @vitest-environment jsdom
//
// AlertPreferencesPanel — collapsible settings form for coinarb-heartbeat
// thresholds (Wave 5 item 22). Covers: collapsed by default (no fetch
// fired), expands and fetches on click, edits + saves via PUT, error toast
// on save failure.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));

import { AlertPreferencesPanel } from "../AlertPreferencesPanel.client";

function buildFetchMock() {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: unknown;
    if (init?.body) { try { body = JSON.parse(init.body as string); } catch { /* ignore */ } }
    calls.push({ url, method, body });
    if (method === "PUT") {
      return { ok: true, json: async () => ({ preferences: body }) } as Response;
    }
    return { ok: true, json: async () => ({ preferences: { coinarb_heartbeat_stale_sec: 300, coinarb_heartbeat_dedup_minutes: 30 }, isDefault: true }) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("AlertPreferencesPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("starts collapsed and does not fetch until expanded", () => {
    const calls = buildFetchMock();
    render(<AlertPreferencesPanel />);
    expect(screen.queryByText(/Heartbeat stale/i)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("expands, fetches, and shows the default values with a 'default' hint", async () => {
    buildFetchMock();
    render(<AlertPreferencesPanel />);
    fireEvent.click(screen.getByText("Alertas"));

    expect(await screen.findByDisplayValue("300")).toBeDefined();
    expect(screen.getByDisplayValue("30")).toBeDefined();
    expect(screen.getByText("— default")).toBeDefined();
  });

  it("edits a value and saves via PUT", async () => {
    const calls = buildFetchMock();
    render(<AlertPreferencesPanel />);
    fireEvent.click(screen.getByText("Alertas"));
    const staleInput = await screen.findByDisplayValue("300");

    fireEvent.change(staleInput, { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Preferencias de alertas guardadas");
    });
    const putCall = calls.find((c) => c.method === "PUT");
    expect(putCall?.body).toMatchObject({ coinarb_heartbeat_stale_sec: 120, coinarb_heartbeat_dedup_minutes: 30 });
  });

  it("shows an error toast when saving fails", async () => {
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "PUT") {
        return { ok: false, json: async () => ({ error: "Validation failed" }) } as Response;
      }
      return { ok: true, json: async () => ({ preferences: { coinarb_heartbeat_stale_sec: 300, coinarb_heartbeat_dedup_minutes: 30 }, isDefault: true }) } as Response;
    }) as unknown as typeof fetch;

    render(<AlertPreferencesPanel />);
    fireEvent.click(screen.getByText("Alertas"));
    await screen.findByDisplayValue("300");
    fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Validation failed");
    });
  });
});
