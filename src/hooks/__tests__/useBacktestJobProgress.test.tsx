// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBacktestJobProgress } from "../useBacktestJobProgress";

// Hold a reference to the latest subscription's `on` handler so each test can
// directly invoke it as if a postgres_changes event arrived. Mirrors the
// shape used by other Realtime tests in the repo.
let lastUpdateHandler: ((payload: { new: unknown }) => void) | null = null;
let lastSubscribeCallback: ((status: string) => void) | null = null;
let removeChannelSpy: Mock;
let baselineRow: unknown = null;

function makeMockChannel() {
  return {
    on(_event: string, _config: unknown, handler: typeof lastUpdateHandler) {
      lastUpdateHandler = handler;
      return this;
    },
    subscribe(cb: (status: string) => void) {
      lastSubscribeCallback = cb;
      // Most tests want the channel to be marked SUBSCRIBED immediately.
      setTimeout(() => cb("SUBSCRIBED"), 0);
      return this;
    },
  };
}

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: baselineRow, error: null }),
        }),
      }),
    }),
    channel: (_name: string) => makeMockChannel(),
    removeChannel: (...args: unknown[]) => removeChannelSpy(...args),
  }),
}));

describe("useBacktestJobProgress", () => {
  beforeEach(() => {
    lastUpdateHandler = null;
    lastSubscribeCallback = null;
    baselineRow = null;
    removeChannelSpy = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle state when jobId is null", () => {
    const { result } = renderHook(() => useBacktestJobProgress(null));
    expect(result.current.job).toBeNull();
    expect(result.current.subscribed).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("hydrates from baseline fetch on mount", async () => {
    baselineRow = {
      id: "job-1",
      status: "running",
      current_phase: "baseline",
      progress_pct: 25,
      error: null,
      started_at: "2026-06-13T00:00:00Z",
      finished_at: null,
    };

    const { result } = renderHook(() => useBacktestJobProgress("job-1"));
    await waitFor(() => expect(result.current.job?.id).toBe("job-1"));
    expect(result.current.job?.current_phase).toBe("baseline");
    expect(result.current.job?.progress_pct).toBe(25);
  });

  it("flips subscribed=true after SUBSCRIBED status", async () => {
    const { result } = renderHook(() => useBacktestJobProgress("job-2"));
    await waitFor(() => expect(result.current.subscribed).toBe(true));
  });

  it("merges UPDATE events into the job state", async () => {
    baselineRow = {
      id: "job-3",
      status: "queued",
      current_phase: null,
      progress_pct: 0,
      error: null,
      started_at: null,
      finished_at: null,
    };

    const { result } = renderHook(() => useBacktestJobProgress("job-3"));
    await waitFor(() => expect(result.current.job?.status).toBe("queued"));
    await waitFor(() => expect(lastUpdateHandler).not.toBeNull());

    act(() => {
      lastUpdateHandler!({
        new: {
          id: "job-3",
          status: "running",
          current_phase: "monte_carlo",
          progress_pct: 50,
          error: null,
          started_at: "2026-06-13T00:00:00Z",
          finished_at: null,
        },
      });
    });

    await waitFor(() => expect(result.current.job?.current_phase).toBe("monte_carlo"));
    expect(result.current.job?.progress_pct).toBe(50);
    expect(result.current.job?.status).toBe("running");
  });

  it("captures completed/error states from the final UPDATE", async () => {
    const { result } = renderHook(() => useBacktestJobProgress("job-4"));
    await waitFor(() => expect(lastUpdateHandler).not.toBeNull());

    act(() => {
      lastUpdateHandler!({
        new: {
          id: "job-4",
          status: "failed",
          current_phase: "monte_carlo",
          progress_pct: 47.5,
          error: "Engine crashed at bar 145",
          started_at: "2026-06-13T00:00:00Z",
          finished_at: "2026-06-13T00:05:00Z",
        },
      });
    });

    await waitFor(() => expect(result.current.job?.status).toBe("failed"));
    expect(result.current.job?.error).toBe("Engine crashed at bar 145");
  });

  it("CHANNEL_ERROR sets error and unflips subscribed", async () => {
    const { result } = renderHook(() => useBacktestJobProgress("job-err"));
    await waitFor(() => expect(lastSubscribeCallback).not.toBeNull());

    act(() => {
      lastSubscribeCallback!("CHANNEL_ERROR");
    });

    await waitFor(() => expect(result.current.error).toContain("channel_error"));
    expect(result.current.subscribed).toBe(false);
  });

  it("cleans up channel on unmount", async () => {
    const { unmount } = renderHook(() => useBacktestJobProgress("job-cleanup"));
    await waitFor(() => expect(lastUpdateHandler).not.toBeNull());
    unmount();
    expect(removeChannelSpy).toHaveBeenCalled();
  });

  it("changing jobId resubscribes and resets state", async () => {
    baselineRow = { id: "job-a", status: "queued", current_phase: null, progress_pct: 0, error: null, started_at: null, finished_at: null };
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useBacktestJobProgress(id), {
      initialProps: { id: "job-a" as string | null },
    });
    await waitFor(() => expect(result.current.job?.id).toBe("job-a"));

    baselineRow = { id: "job-b", status: "running", current_phase: "baseline", progress_pct: 10, error: null, started_at: "2026-06-13T00:00:00Z", finished_at: null };
    rerender({ id: "job-b" });
    await waitFor(() => expect(result.current.job?.id).toBe("job-b"));
    expect(removeChannelSpy).toHaveBeenCalled();
  });
});
