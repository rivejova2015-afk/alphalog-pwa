// @vitest-environment jsdom
//
// DispatchModeBanner — client component que fetcha /api/algorithms/runtime-config
// y renderiza un banner amber sólo cuando mode==='shadow'. Validates:
//   1. Renders nothing inicialmente (mode='unknown').
//   2. After fetch returns shadow → banner aparece con texto explicativo.
//   3. After fetch returns live → banner se mantiene oculto (clean UI).
//   4. After fetch errors (network) → banner se mantiene oculto (silent fail).
//   5. After fetch returns non-2xx → banner se mantiene oculto.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DispatchModeBanner } from "../DispatchModeBanner.client";

function mockFetchResponse(body: unknown, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok:   status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function mockFetchReject(err: Error) {
  globalThis.fetch = vi.fn().mockRejectedValue(err) as unknown as typeof fetch;
}

describe("DispatchModeBanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing initially before the fetch resolves (mode=unknown)", () => {
    // Fetch never resolves — banner stays hidden.
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<DispatchModeBanner />);
    expect(container.textContent).toBe("");
  });

  it("renders amber banner when /runtime-config returns shadow", async () => {
    mockFetchResponse({ dispatch_mode: "shadow" });
    render(<DispatchModeBanner />);

    await waitFor(() => {
      expect(screen.getByText(/Modo shadow activo/i)).toBeDefined();
    });
    expect(screen.getByText(/DISPATCH_MODE=live/)).toBeDefined();
  });

  it("stays hidden when runtime-config returns live", async () => {
    mockFetchResponse({ dispatch_mode: "live" });
    const { container } = render(<DispatchModeBanner />);

    // Allow microtasks to settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe("");
    expect(screen.queryByText(/Modo shadow/i)).toBeNull();
  });

  it("stays hidden when runtime-config returns an unrecognized value (mode=unknown)", async () => {
    mockFetchResponse({ dispatch_mode: "something_unexpected" });
    const { container } = render(<DispatchModeBanner />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe("");
  });

  it("stays hidden when fetch returns non-2xx", async () => {
    mockFetchResponse({ error: "Unauthorized" }, 401);
    const { container } = render(<DispatchModeBanner />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe("");
  });

  it("stays hidden when fetch rejects (network error, silent fail)", async () => {
    mockFetchReject(new Error("net::ERR_INTERNET_DISCONNECTED"));
    const { container } = render(<DispatchModeBanner />);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.textContent).toBe("");
  });

  it("calls /api/algorithms/runtime-config with cache:'no-store'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ dispatch_mode: "shadow" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<DispatchModeBanner />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/algorithms/runtime-config",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });
});
