// @vitest-environment jsdom
//
// usePnlMetrics — hook que carga trades (fetcher inyectado o /api/tradehub/
// trades), aplica filtros, y memoiza PnlTotals con computePnlTotals.
//
// Validates:
//   1. enabled=false → no fetch, loading=false, trades=[].
//   2. fetcher inyectado → returns trades + metrics computed.
//   3. URL params (accountId/setupId/status/range/limit/closedOnly) se
//      construyen correctamente cuando NO hay fetcher inyectado.
//   4. response.ok=false → error parseado del body.error o "Failed to fetch".
//   5. response NO-array (object suelto) → trades=[].
//   6. fetcher throws → error message capturado + trades vacío.
//   7. refresh() reinvoca el fetcher.
//   8. subscribeTradeUpdates listener trigger → reload (refreshOnTradeUpdate).
//   9. refreshOnTradeUpdate=false → NO suscribe a tradeUpdates.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { subscribeMock } = vi.hoisted(() => ({
  subscribeMock: vi.fn(),
}));

vi.mock("@/lib/metrics/tradeUpdates", () => ({
  subscribeTradeUpdates: subscribeMock,
}));

import { usePnlMetrics } from "../usePnlMetrics";

function makeTrade(over: Partial<{ pnl: number; status: string; exit_date: string }> = {}) {
  return {
    id: `t-${Math.random()}`,
    pnl:       over.pnl ?? 100,
    status:    over.status ?? "closed",
    exit_date: over.exit_date ?? "2026-06-10",
  };
}

describe("usePnlMetrics", () => {
  beforeEach(() => {
    subscribeMock.mockReset();
    subscribeMock.mockReturnValue(() => { /* noop unsubscribe */ });
  });

  it("enabled=false → no fetch, loading=false, trades=[]", () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => usePnlMetrics({ enabled: false, fetcher }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.trades).toEqual([]);
  });

  it("fetcher inyectado retorna trades + metrics computed", async () => {
    const fetcher = vi.fn().mockResolvedValue([
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: 200 }),
    ]);
    const { result } = renderHook(() => usePnlMetrics({ fetcher }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trades).toHaveLength(3);
    expect(result.current.metrics.totalPnl).toBe(250);
    expect(result.current.metrics.wins).toBe(2);
    expect(result.current.metrics.losses).toBe(1);
  });

  it("URL params construidos correctamente cuando NO hay fetcher", async () => {
    let capturedUrl = "";
    globalThis.fetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return { ok: true, json: async () => [] } as unknown as Response;
    }) as unknown as typeof fetch;

    renderHook(() => usePnlMetrics({
      accountId: "acc-1",
      setupId:   "set-9",
      status:    "closed",
      range:     "30d",
      limit:     100,
    }));

    await waitFor(() => {
      expect(capturedUrl).toContain("/api/tradehub/trades?");
      expect(capturedUrl).toContain("accountId=acc-1");
      expect(capturedUrl).toContain("setupId=set-9");
      expect(capturedUrl).toContain("status=closed");
      expect(capturedUrl).toContain("closedOnly=true");
      expect(capturedUrl).toContain("range=30d");
      expect(capturedUrl).toContain("limit=100");
      expect(capturedUrl).toContain("offset=0");
    });
  });

  it("response.ok=false con error en body → error message", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500,
      json: async () => ({ error: "rls denied" }),
    } as unknown as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => usePnlMetrics({}));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("rls denied");
    expect(result.current.trades).toEqual([]);
  });

  it("response.ok=false sin body.error → fallback 'Failed to fetch trades'", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false, status: 500,
      json: async () => ({}),
    } as unknown as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => usePnlMetrics({}));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to fetch trades");
  });

  it("response NO-array (object suelto) → trades=[]", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    } as unknown as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => usePnlMetrics({}));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trades).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("fetcher throws → error message capturado + trades vacío", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network ECONNREFUSED"));
    const { result } = renderHook(() => usePnlMetrics({ fetcher }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("network ECONNREFUSED");
    expect(result.current.trades).toEqual([]);
  });

  it("refresh() reinvoca el fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => usePnlMetrics({ fetcher }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("subscribeTradeUpdates listener trigger → reload", async () => {
    let triggerUpdate: () => void = () => {};
    subscribeMock.mockImplementation((cb: () => void) => {
      triggerUpdate = cb;
      return () => { /* unsubscribe */ };
    });

    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() => usePnlMetrics({ fetcher }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      triggerUpdate();
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });

  it("refreshOnTradeUpdate=false → NO suscribe a tradeUpdates", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    renderHook(() => usePnlMetrics({ fetcher, refreshOnTradeUpdate: false }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(subscribeMock).not.toHaveBeenCalled();
  });

  it("filtros closedOnly/ignoreZero pasan al computePnlTotals", async () => {
    const fetcher = vi.fn().mockResolvedValue([
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: 0 }),    // zero
      makeTrade({ pnl: -50 }),
    ]);
    const { result } = renderHook(() => usePnlMetrics({
      fetcher, ignoreZero: true,
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // ignoreZero=true → ops counts solo wins + losses = 2
    expect(result.current.metrics.ops).toBe(2);
  });
});
