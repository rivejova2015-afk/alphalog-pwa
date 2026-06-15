// @vitest-environment jsdom
//
// useAutoTuneStream — opens SSE endpoint y parsea frames (event:<name>\n
// data:<json>\n\n) en estados: meta, trials[], best, progress, error,
// isStreaming, isDone.
//
// Validates:
//   1. Estado inicial: meta=null, trials=[], best=null, progress=null,
//      error=null, isStreaming=false, isDone=false.
//   2. start() pone isStreaming=true y resetea otros estados.
//   3. start() invoca fetch con POST + Accept: text/event-stream + body JSON.
//   4. meta frame → setMeta.
//   5. trial frames acumulan en trials[] + actualizan progress.
//   6. done frame → setBest + setIsDone=true.
//   7. error frame → setError con payload.message.
//   8. HTTP no-ok → error con "HTTP {status}".
//   9. abort() invoca controller.abort + setIsStreaming=false.
//   10. reset() limpia todos los estados.
//   11. Frame con event desconocido → ignorado (no crash).
//   12. Frame con JSON inválido → ignorado.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useAutoTuneStream } from "../useAutoTuneStream";

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < frames.length) {
        controller.enqueue(encoder.encode(frames[i] + "\n\n"));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

function mockFetchOk(frames: string[]) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    body: sseStream(frames),
    text: async () => "",
  } as unknown as Response)) as unknown as typeof fetch;
}

function mockFetchError(status = 500, errText = "boom") {
  globalThis.fetch = vi.fn(async () => ({
    ok: false,
    status,
    text: async () => errText,
  } as unknown as Response)) as unknown as typeof fetch;
}

describe("useAutoTuneStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Estado inicial: todos default", () => {
    const { result } = renderHook(() => useAutoTuneStream());
    expect(result.current.meta).toBeNull();
    expect(result.current.trials).toEqual([]);
    expect(result.current.best).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isDone).toBe(false);
  });

  it("start() invoca fetch con POST + Accept text/event-stream + body JSON", async () => {
    let capturedUrl  = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      capturedUrl  = url;
      capturedInit = init;
      return { ok: true, status: 200, body: sseStream([]), text: async () => "" } as unknown as Response;
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => {
      result.current.start("/api/auto-tune", { algorithm: "kelly" });
    });

    await waitFor(() => expect(capturedUrl).toBe("/api/auto-tune"));
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((capturedInit?.headers as Record<string, string>).Accept).toBe("text/event-stream");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({ algorithm: "kelly" });
  });

  it("meta frame → setMeta", async () => {
    const metaPayload = {
      symbol: "ES", from: "2026-01-01", to: "2026-06-01",
      sl_range: [1, 5], tp_range: [1, 5],
      skip_degenerate: true,
      bars_loaded: [{ tf: "5m", count: 1000 }],
    };
    mockFetchOk([
      `event: meta\ndata: ${JSON.stringify(metaPayload)}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.meta).not.toBeNull());
    expect(result.current.meta?.symbol).toBe("ES");
    expect(result.current.meta?.bars_loaded).toEqual([{ tf: "5m", count: 1000 }]);
  });

  it("trial frames acumulan + actualizan progress", async () => {
    const t1 = { slAtrMult: 1.5, tpAtrMult: 2.0, sharpe: 1.1, totalPnl: 100, winRate: 0.55, maxDrawdownPct: 0.08, trades: 30, index: 1, total: 3 };
    const t2 = { slAtrMult: 1.5, tpAtrMult: 2.5, sharpe: 1.4, totalPnl: 150, winRate: 0.60, maxDrawdownPct: 0.06, trades: 32, index: 2, total: 3 };

    mockFetchOk([
      `event: trial\ndata: ${JSON.stringify(t1)}`,
      `event: trial\ndata: ${JSON.stringify(t2)}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.trials).toHaveLength(2));
    expect(result.current.trials[0].sharpe).toBe(1.1);
    expect(result.current.trials[1].sharpe).toBe(1.4);
    expect(result.current.progress).toEqual({ current: 2, total: 3 });
  });

  it("done frame → setBest + setIsDone=true", async () => {
    const best = { slAtrMult: 1.5, tpAtrMult: 2.5, sharpe: 1.4, totalPnl: 150, winRate: 0.60, maxDrawdownPct: 0.06, trades: 32, index: 2, total: 3 };
    const donePayload = {
      best,
      trials: [best],
      algorithm: { id: "algo-1", name: "ES Strategy" },
    };

    mockFetchOk([
      `event: done\ndata: ${JSON.stringify(donePayload)}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.isDone).toBe(true));
    expect(result.current.best?.sharpe).toBe(1.4);
  });

  it("error frame → setError con payload.message", async () => {
    mockFetchOk([
      `event: error\ndata: ${JSON.stringify({ message: "engine crashed" })}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.error).toBe("engine crashed"));
  });

  it("error frame sin .message → fallback 'Stream error'", async () => {
    mockFetchOk([
      `event: error\ndata: ${JSON.stringify({})}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.error).toBe("Stream error"));
  });

  it("HTTP no-ok → error con 'HTTP {status}'", async () => {
    mockFetchError(500, "internal");

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.error).toContain("HTTP 500"));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it("abort() invoca controller.abort + isStreaming=false", async () => {
    // Hang the stream so abort can interrupt
    globalThis.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      body: new ReadableStream({ pull() { /* never resolves */ } }),
      text: async () => "",
    } as unknown as Response)) as unknown as typeof fetch;

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => result.current.abort());
    expect(result.current.isStreaming).toBe(false);
  });

  it("reset() limpia todos los estados", async () => {
    mockFetchOk([
      `event: meta\ndata: ${JSON.stringify({
        symbol: "ES", from: "x", to: "y", sl_range: [], tp_range: [],
        skip_degenerate: false, bars_loaded: [],
      })}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));
    await waitFor(() => expect(result.current.meta).not.toBeNull());

    act(() => result.current.reset());
    expect(result.current.meta).toBeNull();
    expect(result.current.trials).toEqual([]);
    expect(result.current.best).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isDone).toBe(false);
  });

  it("Frame con event desconocido → ignorado (no crash)", async () => {
    mockFetchOk([
      `event: weird_event\ndata: ${JSON.stringify({ x: 1 })}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.trials).toEqual([]);
  });

  it("Frame con JSON inválido → ignorado", async () => {
    mockFetchOk([
      `event: trial\ndata: not-json-here`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));

    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.trials).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("Estados resetan al inicio de start() (segunda llamada)", async () => {
    mockFetchOk([
      `event: error\ndata: ${JSON.stringify({ message: "first" })}`,
    ]);

    const { result } = renderHook(() => useAutoTuneStream());
    act(() => result.current.start("/api/auto-tune", {}));
    await waitFor(() => expect(result.current.error).toBe("first"));

    // Second call: should reset state (error null) and start streaming again
    mockFetchOk([]);
    act(() => result.current.start("/api/auto-tune", {}));
    // start() synchronously sets isStreaming=true and clears error
    expect(result.current.error).toBeNull();
  });
});
