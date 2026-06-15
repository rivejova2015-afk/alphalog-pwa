// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBacktestStream } from "../useBacktestStream";

interface ResultShape { value: number }

/**
 * Builds a Response whose body is a ReadableStream we can feed chunks into
 * from the test. Returns the controller so each test pushes its own frames
 * in whichever order/timing it wants.
 */
function makeSseResponse(): {
  response: Response;
  push: (chunk: string) => void;
  close: () => void;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });
  const encoder = new TextEncoder();
  const response = new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
  return {
    response,
    push: (chunk) => controller?.enqueue(encoder.encode(chunk)),
    close: () => controller?.close(),
  };
}

describe("useBacktestStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.meta).toBeNull();
    expect(result.current.phase).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("parses a complete event sequence: meta → progress → done", async () => {
    const { response, push, close } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());

    act(() => {
      result.current.start("/api/algorithms/x/engine-backtest?stream=true", { foo: "bar" });
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => {
      push(`event: meta\ndata: ${JSON.stringify({ symbol: "EURUSD", from: "2026-01-01", to: "2026-02-01", bars_loaded: [{ tf: "M15", count: 100 }] })}\n\n`);
    });
    await waitFor(() => expect(result.current.meta?.symbol).toBe("EURUSD"));

    act(() => {
      push(`event: progress\ndata: ${JSON.stringify({ phase: "baseline", step: "start" })}\n\n`);
    });
    await waitFor(() => expect(result.current.phase?.phase).toBe("baseline"));

    act(() => {
      push(`event: progress\ndata: ${JSON.stringify({ phase: "monte_carlo", step: "progress", current: 50, total: 100 })}\n\n`);
    });
    await waitFor(() => expect(result.current.phase?.current).toBe(50));

    act(() => {
      push(`event: done\ndata: ${JSON.stringify({ value: 42 })}\n\n`);
      close();
    });

    await waitFor(() => expect(result.current.result?.value).toBe(42));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("handles frames split across multiple chunks", async () => {
    const { response, push, close } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    // Push a single frame in 3 separate chunks. The reader buffer should
    // assemble them correctly before parsing.
    act(() => push("event: meta\n"));
    act(() => push(`data: ${JSON.stringify({ symbol: "BTCUSD", from: "x", to: "y", bars_loaded: [] }).slice(0, 20)}`));
    act(() => push(`${JSON.stringify({ symbol: "BTCUSD", from: "x", to: "y", bars_loaded: [] }).slice(20)}\n\n`));
    act(() => close());

    await waitFor(() => expect(result.current.meta?.symbol).toBe("BTCUSD"));
  });

  it("captures HTTP errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Bad input", { status: 400 })
    );

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toContain("HTTP 400");
    expect(result.current.isStreaming).toBe(false);
  });

  it("captures server-side error events", async () => {
    const { response, push, close } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => {
      push(`event: error\ndata: ${JSON.stringify({ message: "Engine crashed at i=145" })}\n\n`);
      close();
    });

    await waitFor(() => expect(result.current.error).toBe("Engine crashed at i=145"));
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it("reset() restores idle state", async () => {
    const { response, push, close } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => {
      push(`event: done\ndata: ${JSON.stringify({ value: 1 })}\n\n`);
      close();
    });
    await waitFor(() => expect(result.current.result?.value).toBe(1));

    act(() => result.current.reset());
    expect(result.current.result).toBeNull();
    expect(result.current.phase).toBeNull();
    expect(result.current.meta).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("ignores malformed JSON in data lines", async () => {
    const { response, push, close } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    // Bad JSON should not throw — the consumer skips the frame.
    act(() => push("event: meta\ndata: {invalid-json\n\n"));
    // A valid frame after should still parse normally.
    act(() => {
      push(`event: meta\ndata: ${JSON.stringify({ symbol: "X", from: "a", to: "b", bars_loaded: [] })}\n\n`);
      close();
    });
    await waitFor(() => expect(result.current.meta?.symbol).toBe("X"));
  });

  it("abort() stops streaming", async () => {
    const { response, push } = makeSseResponse();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useBacktestStream<ResultShape>());
    act(() => result.current.start("/api/test", {}));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    act(() => {
      push(`event: progress\ndata: ${JSON.stringify({ phase: "baseline", step: "start" })}\n\n`);
    });
    await waitFor(() => expect(result.current.phase?.phase).toBe("baseline"));

    act(() => result.current.abort());
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });
});
