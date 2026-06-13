// useBacktestStream — opens an SSE connection to the engine-backtest endpoint
// with `?stream=true` and exposes phase progress + the final result.
//
// Why a custom EventSource handler instead of `new EventSource()`:
//   - EventSource is GET-only; our route uses POST with a JSON body
//     (algorithm + config). The server's text/event-stream response works
//     identically over any HTTP method when we parse the body ourselves.
//   - AbortController gives us clean cancel-on-unmount semantics.
//
// Pattern mirrors how the terminal chat client consumes /api/terminal/chat
// (text/event-stream + `event: X\ndata: {json}\n\n`).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface BacktestPhaseEvent {
  phase: "baseline" | "monte_carlo" | "walk_forward" | "done";
  step: "start" | "progress" | "done";
  current?: number;
  total?: number;
}

export interface BacktestStreamMeta {
  symbol: string;
  from: string;
  to: string;
  bars_loaded: Array<{ tf: string; count: number }>;
}

export interface UseBacktestStreamState<TResult> {
  /** Last meta event from the server (symbol, range, bar counts). */
  meta: BacktestStreamMeta | null;
  /** Latest phase event. Drives "Running baseline..." / "Walk-forward 3/5". */
  phase: BacktestPhaseEvent | null;
  /** When the run completes successfully, the full JSON payload lives here. */
  result: TResult | null;
  /** Server-side error message (HTTP failure, validation error, runtime crash). */
  error: string | null;
  /** True between `start()` and the final `done`/`error` event. */
  isStreaming: boolean;
}

export interface UseBacktestStreamControls<TResult> extends UseBacktestStreamState<TResult> {
  /** Begin a stream. Cancels any in-flight stream first. */
  start: (url: string, body: unknown) => void;
  /** Abort the current stream. No-op when idle. */
  abort: () => void;
  /** Reset all state to initial (for "Run again"). */
  reset: () => void;
}

/**
 * Generic SSE consumer for backtest runs. The component owns the result shape
 * via the type parameter so this hook stays agnostic to which backtest path
 * (sync engine v1 vs async run-job) is wired.
 */
export function useBacktestStream<TResult = unknown>(): UseBacktestStreamControls<TResult> {
  const [meta, setMeta] = useState<BacktestStreamMeta | null>(null);
  const [phase, setPhase] = useState<BacktestPhaseEvent | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setMeta(null);
    setPhase(null);
    setResult(null);
    setError(null);
    setIsStreaming(false);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback((url: string, body: unknown) => {
    // Cancel any prior in-flight stream so we never have two readers.
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setMeta(null);
    setPhase(null);
    setResult(null);
    setError(null);
    setIsStreaming(true);

    // The actual fetch runs in an async IIFE so we can return synchronously.
    void (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body ?? {}),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          setError(`HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ""}`);
          setIsStreaming(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("Stream not supported by this browser");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        // SSE frame separator is double-newline. We buffer partial reads
        // until we see one, then parse the complete frame.
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx = buffer.indexOf("\n\n");
          while (sepIdx !== -1) {
            const frame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            handleFrame<TResult>(frame, { setMeta, setPhase, setResult, setError });
            sepIdx = buffer.indexOf("\n\n");
          }
        }
        // Drain any trailing frame (server should always end with \n\n, but
        // defensive code never hurts).
        if (buffer.trim()) handleFrame<TResult>(buffer, { setMeta, setPhase, setResult, setError });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Caller-initiated abort — not an error condition.
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    })();
  }, []);

  // Clean up on unmount so a leaving user doesn't keep a dangling fetch.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { meta, phase, result, error, isStreaming, start, abort, reset };
}

interface FrameSetters<T> {
  setMeta: (m: BacktestStreamMeta) => void;
  setPhase: (p: BacktestPhaseEvent) => void;
  setResult: (r: T) => void;
  setError: (msg: string) => void;
}

function handleFrame<T>(frame: string, setters: FrameSetters<T>): void {
  // A frame is one or more "key: value" lines. We care about `event:` and
  // `data:`. Multi-line `data:` payloads (rare for us — we JSON-encode) are
  // concatenated per the SSE spec, but the server only ever sends single-line
  // JSON so the simple split is sufficient.
  const lines = frame.split("\n");
  let eventName = "message";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return;

  let payload: unknown;
  try {
    payload = JSON.parse(dataLine);
  } catch {
    // Malformed JSON shouldn't blow up the consumer — log to console via
    // browser devtools and move on. (In a server context we'd use logError.)
    return;
  }

  switch (eventName) {
    case "meta":
      setters.setMeta(payload as BacktestStreamMeta);
      return;
    case "progress":
      setters.setPhase(payload as BacktestPhaseEvent);
      return;
    case "done":
      setters.setResult(payload as T);
      // Also surface "done" as a phase event so the UI can hide its
      // progress indicator on the same render tick.
      setters.setPhase({ phase: "done", step: "done" });
      return;
    case "error":
      setters.setError((payload as { message?: string }).message ?? "Stream error");
      return;
    default:
      return;
  }
}
