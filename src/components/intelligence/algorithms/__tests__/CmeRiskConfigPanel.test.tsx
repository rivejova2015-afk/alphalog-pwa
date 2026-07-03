// @vitest-environment jsdom
//
// CmeRiskConfigPanel — self-fetching risk config editor (Wave 4 item 20).
// Covers: loading skeleton, array-vs-object response normalization, default
// fallbacks when config is null, paused/active toggle labels + paused_reason
// badge, save flow, and toggle flow (including the `paused_reason: null`
// reset when re-enabling).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: toastSuccessMock, message: vi.fn() } }));

import CmeRiskConfigPanel from "../CmeRiskConfigPanel.client";

function buildFetchMock(getResponse: unknown, postResponse: { ok: boolean; data?: unknown; error?: string } = { ok: true, data: {} }) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    let body: unknown;
    if (init?.body) { try { body = JSON.parse(init.body as string); } catch { /* ignore */ } }
    calls.push({ url, method, body });
    if (method === "POST") {
      return { ok: postResponse.ok, json: async () => (postResponse.ok ? { data: postResponse.data } : { error: postResponse.error }) } as Response;
    }
    return { ok: true, json: async () => ({ data: getResponse }) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("CmeRiskConfigPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("shows a loading skeleton before the fetch resolves", () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("normalizes an array response (takes [0]) and populates cbPct/maxPos from it", async () => {
    buildFetchMock([{ id: "cfg-1", enabled: true, circuit_breaker_pct: 65, max_positions: 3, paused_reason: null, paused_at: null }]);
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);

    expect(await screen.findByDisplayValue("65")).toBeDefined();
    expect(screen.getByDisplayValue("3")).toBeDefined();
    expect(screen.getByText("Trading Active")).toBeDefined();
  });

  it("defaults cbPct=80 and an empty maxPos when config is null", async () => {
    buildFetchMock(null);
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);

    expect(await screen.findByText("Trading Paused")).toBeDefined();
    expect(screen.getByDisplayValue("80")).toBeDefined();
    expect(screen.getByPlaceholderText("Unlimited")).toHaveValue(null);
  });

  it("shows the paused_reason badge (underscore replaced with space) when set", async () => {
    buildFetchMock({ id: "cfg-1", enabled: false, circuit_breaker_pct: 80, max_positions: null, paused_reason: "daily_loss", paused_at: "2026-01-01" });
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);
    expect(await screen.findByText("daily loss")).toBeDefined();
  });

  it("saves the risk config with the entered values", async () => {
    const calls = buildFetchMock(
      { id: "cfg-1", enabled: true, circuit_breaker_pct: 80, max_positions: null, paused_reason: null, paused_at: null },
      { ok: true, data: { id: "cfg-1", enabled: true, circuit_breaker_pct: 90, max_positions: 5, paused_reason: null, paused_at: null } },
    );
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);
    await screen.findByText("Trading Active");

    fireEvent.change(screen.getByDisplayValue("80"), { target: { value: "90" } });
    fireEvent.change(screen.getByPlaceholderText("Unlimited"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Risk Config/i }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Risk config saved"));
    const postCall = calls.find((c) => c.method === "POST");
    expect(postCall?.body).toMatchObject({ cmeAccountId: "acc-1", circuit_breaker_pct: 90, max_positions: 5 });
  });

  it("toggling from paused → active resets paused_reason to null in the payload", async () => {
    const calls = buildFetchMock(
      { id: "cfg-1", enabled: false, circuit_breaker_pct: 80, max_positions: null, paused_reason: "manual", paused_at: "2026-01-01" },
      { ok: true, data: { id: "cfg-1", enabled: true, circuit_breaker_pct: 80, max_positions: null, paused_reason: null, paused_at: null } },
    );
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);
    await screen.findByText("Trading Paused");

    fireEvent.click(screen.getByRole("button", { name: /Resume/i }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Trading enabled"));
    const postCall = calls.find((c) => c.method === "POST");
    expect(postCall?.body).toMatchObject({ enabled: true, paused_reason: null });
  });

  it("shows an error toast when saving fails", async () => {
    buildFetchMock(
      { id: "cfg-1", enabled: true, circuit_breaker_pct: 80, max_positions: null, paused_reason: null, paused_at: null },
      { ok: false, error: "Invalid config" },
    );
    render(<CmeRiskConfigPanel cmeAccountId="acc-1" />);
    await screen.findByText("Trading Active");

    fireEvent.click(screen.getByRole("button", { name: /Save Risk Config/i }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Invalid config"));
  });
});
