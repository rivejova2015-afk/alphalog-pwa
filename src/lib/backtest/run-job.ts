import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runFullBacktest } from "@/lib/backtest/orchestrator";
import { logError, logInfo } from "@/lib/log";
import type { BacktestConfig } from "@/types/backtest";

const ENGINE_VERSION = "v1";

export async function runBacktestJob(supabase: SupabaseClient, jobId: string): Promise<void> {
  const { data: job, error: jobErr } = await supabase
    .from("backtest_jobs")
    .select("id, user_id, config, status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) {
    logError("BacktestWorker", { component: "run-job", message: jobErr?.message ?? "Job not found", meta: { jobId } });
    return;
  }
  if (job.status !== "queued") return;

  const cfg = job.config as BacktestConfig;

  await supabase
    .from("backtest_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      current_phase: "loading_bars",
      progress_pct: 1,
      engine_version: ENGINE_VERSION,
    })
    .eq("id", job.id);

  try {
    const bars = await loadHistoricalBars(supabase, cfg.symbol, cfg.timeframe, cfg.from, cfg.to);
    if (bars.length < 60) {
      await supabase
        .from("backtest_jobs")
        .update({
          status: "failed",
          error: `Not enough bars: ${bars.length}. Run the historical bridge to ingest data.`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return;
    }

    logInfo("BacktestWorker", `Loaded ${bars.length} bars`, { component: "run-job", meta: { jobId: job.id } });

    const result = await runFullBacktest(bars, cfg, async ({ phase, pct }) => {
      await supabase
        .from("backtest_jobs")
        .update({ current_phase: phase, progress_pct: pct })
        .eq("id", job.id);
    });

    await supabase.from("backtest_results").upsert({
      job_id: job.id,
      user_id: job.user_id,
      metrics: result.baseline.metrics,
      equity_curve: result.baseline.equityCurve,
      trades: result.baseline.trades,
      monte_carlo: result.monteCarlo,
      walk_forward: result.walkForward,
      stress_tests: result.stress,
      sensitivity: null,
      regime: result.regime,
      robustness: result.robustness,
    });

    await supabase
      .from("backtest_jobs")
      .update({
        status: "completed",
        progress_pct: 100,
        current_phase: "done",
        finished_at: new Date().toISOString(),
        error: result.warnings.length > 0 ? `Completed with warnings: ${result.warnings.join("; ")}` : null,
      })
      .eq("id", job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("BacktestWorker", { component: "run-job", message: msg, meta: { jobId: job.id } });
    await supabase
      .from("backtest_jobs")
      .update({
        status: "failed",
        error: msg.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  }
}
