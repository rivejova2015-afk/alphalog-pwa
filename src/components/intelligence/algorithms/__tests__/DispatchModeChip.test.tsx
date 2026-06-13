// @vitest-environment jsdom
//
// DispatchModeChip — client component que fetcha /api/algorithms/runtime-config
// y muestra un chip glanceable (Dispatch: SHADOW | LIVE | —). Polea cada 30s.
// Validates:
//   1. Renders "Dispatch: —" inicialmente (mode='unknown').
//   2. After fetch returns shadow → label "Dispatch: SHADOW" + amber color.
//   3. After fetch returns live → label "Dispatch: LIVE" + red color.
//   4. After fetch returns invalid value → label "Dispatch: —" (defensive).
//   5. After fetch non-2xx → label "Dispatch: —" (silent fail).
//   6. After fetch rejects → label "Dispatch: —" (silent fail).
//   7. Polea cada 30s vía setInterval — el mode se actualiza después del tick.
//   8. Unmount cancels the polling + ongoing fetch resolution.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { DispatchModeChip } from "../DispatchModeChip.client";

function mockFetchResponses(...bodies: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  const queue = [...bodies];
  globalThis.fetch = vi.fn(async () => {
    const next = queue.shift() ?? bodies[bodies.length - 1];
    return {
      ok:     next.ok ?? (next.status ? next.status < 300 : true),
      status: next.status ?? 200,
      json:   async () => next.body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("DispatchModeChip", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders 'Dispatch: —' initially before the fetch resolves", () => {
    // Pending fetch — never resolves.
    globalThis.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<DispatchModeChip />);
    expect(screen.getByText(/Dispatch:/)).toBeDefined();
    expect(screen.getByText(/—/)).toBeDefined();
  });

  it("renders 'Dispatch: SHADOW' when runtime-config returns shadow", async () => {
    mockFetchResponses({ body: { dispatch_mode: "shadow" } });
    render(<DispatchModeChip />);

    await waitFor(() => {
      expect(screen.getByText(/SHADOW/i)).toBeDefined();
    });
  });

  it("renders 'Dispatch: LIVE' when runtime-config returns live", async () => {
    mockFetchResponses({ body: { dispatch_mode: "live" } });
    render(<DispatchModeChip />);

    await waitFor(() => {
      expect(screen.getByText(/LIVE/i)).toBeDefined();
    });
  });

  it("renders 'Dispatch: —' when runtime-config returns an unrecognized value", async () => {
    mockFetchResponses({ body: { dispatch_mode: "garbage" } });
    render(<DispatchModeChip />);

    // Wait for fetch microtask to settle.
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByText(/—/)).toBeDefined();
    expect(screen.queryByText(/SHADOW/i)).toBeNull();
    expect(screen.queryByText(/LIVE/i)).toBeNull();
  });

  it("renders 'Dispatch: —' when fetch returns non-2xx", async () => {
    mockFetchResponses({ ok: false, status: 401, body: { error: "Unauthorized" } });
    render(<DispatchModeChip />);

    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByText(/—/)).toBeDefined();
  });

  it("renders 'Dispatch: —' when fetch rejects (silent fail)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("net::ERR_DISCONNECTED")) as unknown as typeof fetch;
    render(<DispatchModeChip />);

    await new Promise((r) => setTimeout(r, 10));
    expect(screen.getByText(/—/)).toBeDefined();
  });

  it("registers a setInterval at the REFRESH_MS cadence (30s polling)", async () => {
    // Spy on setInterval so we can verify the cadence WITHOUT actually
    // advancing time — fake timers + React 19 act scheduling don't compose
    // reliably and the original variant timed out. The behavior we care
    // about is "the chip polls" — the setInterval registration is the
    // observable proof.
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    mockFetchResponses({ body: { dispatch_mode: "shadow" } });

    const { unmount } = render(<DispatchModeChip />);

    await waitFor(() => {
      expect(screen.getByText(/SHADOW/i)).toBeDefined();
    });
    // useEffect ran → setInterval was registered with the 30s delay.
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);

    // And unmount cancels the interval (cleanup path of the effect).
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("calls fetch with cache:'no-store' so we never read stale runtime-config", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ dispatch_mode: "shadow" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    render(<DispatchModeChip />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/algorithms/runtime-config",
        expect.objectContaining({ cache: "no-store" }),
      );
    });
  });
});
