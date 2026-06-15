// useBacktestJobProgress — Supabase Realtime subscription to a single
// backtest_jobs row. Sister hook to useBacktestStream (which uses SSE for the
// sync path). When the BacktestPanel has an active running job, this hook
// streams its phase and progress_pct in real time without polling.
//
// Pattern mirrors `liveAlphaLog.ts` + `useRealtime.ts` already in the repo:
//   - createClient() from browser supabase
//   - supabase.channel(name).on('postgres_changes', ...).subscribe()
//   - cleanup unsubscribe on unmount or jobId change

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

export interface BacktestJobProgress {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current_phase: string | null;
  progress_pct: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface UseBacktestJobProgressState {
  /** Latest row snapshot from Realtime UPDATEs (null until first event). */
  job: BacktestJobProgress | null;
  /** True once the subscription is live. */
  subscribed: boolean;
  /** Set if the subscription itself errored (NOT the job — job.error covers that). */
  error: string | null;
}

/**
 * Subscribe to UPDATE events for one backtest_jobs row by id. Passing null
 * unsubscribes (useful when there's no active job to track).
 *
 * The hook fetches the current row once at mount via REST so the UI has a
 * baseline state before Realtime catches up — eliminates the brief "no data
 * yet" flash on subscription start.
 */
export function useBacktestJobProgress(jobId: string | null): UseBacktestJobProgressState {
  const [job, setJob] = useState<BacktestJobProgress | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setSubscribed(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    // Baseline fetch — surfaces the current job state immediately so the UI
    // can render progress while we wait for the next UPDATE event.
    (async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("backtest_jobs")
          .select("id, status, current_phase, progress_pct, error, started_at, finished_at")
          .eq("id", jobId)
          .maybeSingle();
        if (cancelled) return;
        if (fetchErr) {
          setError(fetchErr.message);
          return;
        }
        if (data) setJob(data as BacktestJobProgress);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    // Realtime subscription — single-row filter so the channel only fires
    // when this specific job changes (cheap on Postgres + Supabase Realtime
    // gateway). Status events (queued → running → completed) and
    // intermediate progress updates from run-job.ts both arrive here.
    const channel = supabase
      .channel(`backtest_job:${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "backtest_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const next = payload.new as BacktestJobProgress;
          setJob(next);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setSubscribed(true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError(`Realtime subscription ${status.toLowerCase()}`);
          setSubscribed(false);
        }
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, subscribed, error };
}
