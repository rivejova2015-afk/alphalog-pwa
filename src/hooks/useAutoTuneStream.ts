// useAutoTuneStream — opens the auto-tune SSE endpoint and exposes trials
// as they arrive (Mejora #6).
//
// The wire format mirrors useBacktestStream (event: <name>\ndata: <json>\n\n)
// but the event names are different: meta + trial × N + done + error. Each
// "trial" appends to `trials[]`; "done" sets `best` and the trials list to the
// final array from the server (which should equal the accumulated one).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AutoTuneMeta {
  symbol: string;
  from: string;
  to: string;
  sl_range: number[];
  tp_range: number[];
  skip_degenerate: boolean;
  bars_loaded: Array<{ tf: string; count: number }>;
}

export interface AutoTuneTrial {
  slAtrMult: number;
  tpAtrMult: number;
  sharpe: number;
  totalPnl: number;
  winRate: number;
  maxDrawdownPct: number;
  trades: number;
  index: number;
  total: number;
}

export interface AutoTuneDone {
  best: AutoTuneTrial;
  trials: AutoTuneTrial[];
  algorithm: { id: string; name: string };
}

export interface UseAutoTuneStreamState {
  meta: AutoTuneMeta | null;
  trials: AutoTuneTrial[];
  best: AutoTuneTrial | null;
  progress: { current: number; total: number } | null;
  error: string | null;
  isStreaming: boolean;
  isDone: boolean;
}

export interface UseAutoTuneStreamControls extends UseAutoTuneStreamState {
  start: (url: string, body: unknown) => void;
  abort: () => void;
  reset: () => void;
}

export function useAutoTuneStream(): UseAutoTuneStreamControls {
  const [meta, setMeta] = useState<AutoTuneMeta | null>(null);
  const [trials, setTrials] = useState<AutoTuneTrial[]>([]);
  const [best, setBest] = useState<AutoTuneTrial | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setMeta(null);
    setTrials([]);
    setBest(null);
    setProgress(null);
    setError(null);
    setIsStreaming(false);
    setIsDone(false);
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback((url: string, body: unknown) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setMeta(null);
    setTrials([]);
    setBest(null);
    setProgress(null);
    setError(null);
    setIsStreaming(true);
    setIsDone(false);

    void (async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
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
          setError("Stream not supported");
          setIsStreaming(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sepIdx = buffer.indexOf("\n\n");
          while (sepIdx !== -1) {
            const frame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            handleFrame(frame, { setMeta, setTrials, setBest, setProgress, setError, setIsDone });
            sepIdx = buffer.indexOf("\n\n");
          }
        }
        if (buffer.trim()) handleFrame(buffer, { setMeta, setTrials, setBest, setProgress, setError, setIsDone });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { meta, trials, best, progress, error, isStreaming, isDone, start, abort, reset };
}

interface FrameSetters {
  setMeta: (m: AutoTuneMeta) => void;
  setTrials: React.Dispatch<React.SetStateAction<AutoTuneTrial[]>>;
  setBest: (t: AutoTuneTrial) => void;
  setProgress: (p: { current: number; total: number }) => void;
  setError: (msg: string) => void;
  setIsDone: (d: boolean) => void;
}

function handleFrame(frame: string, setters: FrameSetters): void {
  const lines = frame.split("\n");
  let eventName = "message";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine) return;

  let payload: unknown;
  try { payload = JSON.parse(dataLine); } catch { return; }

  switch (eventName) {
    case "meta":
      setters.setMeta(payload as AutoTuneMeta);
      return;
    case "trial": {
      const trial = payload as AutoTuneTrial;
      setters.setTrials((prev) => [...prev, trial]);
      setters.setProgress({ current: trial.index, total: trial.total });
      return;
    }
    case "done": {
      const done = payload as AutoTuneDone;
      setters.setBest(done.best);
      setters.setIsDone(true);
      return;
    }
    case "error":
      setters.setError((payload as { message?: string }).message ?? "Stream error");
      return;
    default:
      return;
  }
}
