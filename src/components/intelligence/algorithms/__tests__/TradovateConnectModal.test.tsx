// @vitest-environment jsdom
//
// TradovateConnectModal — unit tests.
// Until now the modal lived without dedicated coverage (mocked to `() => null`
// in 3 sibling tests of AlgorithmDetailsModal). This file fills that gap.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock:   vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock, message: vi.fn() },
}));

import TradovateConnectModal from "../TradovateConnectModal.client";

interface FetchCall { url: string; method: string; headers?: Record<string, string>; body?: unknown }

function buildFetchMock(opts: {
  status?: number;
  body?: unknown;
  throws?: boolean;
} = {}) {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const c: FetchCall = {
      url,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string> | undefined,
    };
    if (init?.body) { try { c.body = JSON.parse(init.body as string); } catch { /* noop */ } }
    calls.push(c);
    if (opts.throws) throw new Error("fetch failed");
    const status = opts.status ?? 200;
    // Default mirrors the real endpoint contract: `{ success, connectionId, ... }`.
    const body = opts.body ?? { success: true, connectionId: "conn-1", tradovateAccountId: 42, tradovateAccountName: "DEMO" };
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

function setCsrfCookie(value: string | null) {
  // Clearing requires re-writing the cookie with past expiry; jsdom allows it.
  if (value === null) {
    document.cookie = "al_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    return;
  }
  document.cookie = `al_csrf=${value}; path=/`;
}

function renderModal(overrides: Partial<React.ComponentProps<typeof TradovateConnectModal>> = {}) {
  const props = {
    cmeAccountId: "cme-acc-1",
    providerName: "TopstepX",
    accountNumber: "TS-123456",
    isPaper: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    ...overrides,
  };
  return { ...render(<TradovateConnectModal {...props} />), props };
}

describe("TradovateConnectModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    setCsrfCookie("test-csrf-token-xyz");
  });

  afterEach(() => {
    setCsrfCookie(null);
  });

  it("renders the modal with provider + account info", () => {
    buildFetchMock();
    renderModal({ providerName: "Apex", accountNumber: "APX-9999", isPaper: true });
    expect(screen.getByText("Conectar a Tradovate")).toBeDefined();
    expect(screen.getByText("Apex")).toBeDefined();
    expect(screen.getByText("APX-9999")).toBeDefined();
    expect(screen.getByText("Paper")).toBeDefined();
  });

  it("renders 'Live' mode label when isPaper=false", () => {
    buildFetchMock();
    renderModal({ isPaper: false });
    expect(screen.getByText("Live")).toBeDefined();
  });

  it("disables the submit button while username or password are empty", () => {
    buildFetchMock();
    renderModal();
    const submit = screen.getByRole("button", { name: /Conectar/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Fill only username
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "user1" } });
    expect(submit.disabled).toBe(true);
    // Fill password too
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "pw1" } });
    expect(submit.disabled).toBe(false);
  });

  it("toggles password visibility on eye click", () => {
    buildFetchMock();
    renderModal();
    const passwordInput = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
    const toggle = screen.getByLabelText("Mostrar password");
    fireEvent.click(toggle);
    expect(passwordInput.type).toBe("text");
    fireEvent.click(screen.getByLabelText("Ocultar password"));
    expect(passwordInput.type).toBe("password");
  });

  it("extracts CSRF token from al_csrf cookie and sends it in x-csrf-token header", async () => {
    const { calls } = buildFetchMock();
    setCsrfCookie("my-csrf-abc");
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].headers?.["x-csrf-token"]).toBe("my-csrf-abc");
  });

  it("POSTs to /api/cme/connect with cmeAccountId + tradovateUsername + tradovatePassword", async () => {
    const { calls } = buildFetchMock();
    renderModal({ cmeAccountId: "the-cme-id" });
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "  alice  " } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].url).toBe("/api/cme/connect");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      cmeAccountId: "the-cme-id",
      tradovateUsername: "alice", // trimmed
      tradovatePassword: "secret",
    });
  });

  it("calls onSuccess + onClose on 200 response with success:true (current endpoint contract)", async () => {
    // The real endpoint returns `{ success: true, connectionId, tradovateAccountId, ... }`.
    buildFetchMock({ status: 200, body: { success: true, connectionId: "conn-99", tradovateAccountId: 1, tradovateAccountName: "X" } });
    const { props } = renderModal({ isPaper: true });
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
    expect(toastSuccessMock).toHaveBeenCalledWith("Conectado a Tradovate (paper)");
  });

  it("also accepts legacy ok:true contract (defensive against endpoint drift)", async () => {
    buildFetchMock({ status: 200, body: { ok: true } });
    const { props } = renderModal({ isPaper: false });
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled());
    expect(toastSuccessMock).toHaveBeenCalledWith("Conectado a Tradovate (live)");
  });

  it("surfaces server error message on 400/500 response", async () => {
    buildFetchMock({ status: 401, body: { ok: false, error: "Invalid Tradovate credentials" } });
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(screen.queryByText("Invalid Tradovate credentials")).not.toBeNull());
  });

  it("falls back to generic HTTP error when server returns non-string error", async () => {
    buildFetchMock({ status: 500, body: { ok: false, error: { issues: ["something broke"] } } });
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(screen.queryByText(/Conexión falló \(HTTP 500\)/)).not.toBeNull());
  });

  it("surfaces network error message on fetch throw", async () => {
    buildFetchMock({ throws: true });
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(screen.queryByText("fetch failed")).not.toBeNull());
  });

  it("disables the form inputs while submitting", async () => {
    let resolveFetch: (v: Response) => void = () => {};
    globalThis.fetch = vi.fn(() => new Promise<Response>((r) => { resolveFetch = r; })) as unknown as typeof fetch;
    renderModal();
    const usernameInput = screen.getByPlaceholderText("tu-usuario-tradovate") as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    fireEvent.change(usernameInput, { target: { value: "alice" } });
    fireEvent.change(passwordInput, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(screen.queryByText("Conectando…")).not.toBeNull());
    expect(usernameInput.disabled).toBe(true);
    expect(passwordInput.disabled).toBe(true);

    // Resolve fetch so the test cleans up without dangling promises.
    resolveFetch({ ok: true, status: 200, json: async () => ({ success: true, connectionId: "x", tradovateAccountId: 1, tradovateAccountName: "Y" }) } as Response);
    await waitFor(() => expect(usernameInput.disabled).toBe(false));
  });

  it("sends empty x-csrf-token when cookie is missing (server will reject)", async () => {
    setCsrfCookie(null);
    const { calls } = buildFetchMock();
    renderModal();
    fireEvent.change(screen.getByPlaceholderText("tu-usuario-tradovate"), { target: { value: "alice" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Conectar/i }));

    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0].headers?.["x-csrf-token"]).toBe("");
  });

  it("clicking the backdrop closes the modal when not submitting", () => {
    buildFetchMock();
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("dialog"));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("clicking the X button closes the modal", () => {
    buildFetchMock();
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText("Cerrar"));
    expect(props.onClose).toHaveBeenCalled();
  });
});
