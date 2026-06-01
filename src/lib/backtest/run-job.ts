import type { SupabaseClient } from "@supabase/supabase-js";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runFullBacktest } from "@/lib/backtest/orchestrator";
import { runPortfolio, type PortfolioLeg } from "@/lib/backtest/portfolio";
import { computeGates } from "@/lib/quality-gates/runner";
import { logError, logInfo, logWarn } from "@/lib/log";
import type { BacktestConfig } from "@/types/backtest";
import type { AdvancedPipeline } from "@/lib/backtest/orchestrator";

const ENGINE_VERSION = "v1";

export async function runBacktestJob(supabase: SupabaseClient, jobId: string): Promise<void> {
  const { data: job, error: jobErr } = await supabase
    .from("backtest_jobs")
    .select("id, user_id, config, status, algorithm_id")
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

    // Multi-TF wiring (Plan v2 — Gap #4). When the user opted in, fetch
    // higher-TF bars in parallel and hydrate cfg.multiTfBars so the engine
    // can build a bias cache and veto contradictory entries. Failures here
    // do NOT abort the run — we leave cfg.multiTfBars empty (filter no-op)
    // and remember the reason to downgrade the advanced block downstream.
    let multiTfLoadError: string | null = null;
    if (cfg.useMultiTf) {
      const higherTfs = cfg.multiTfParams?.higherTimeframes ?? ['H4', 'D1'];
      await supabase
        .from("backtest_jobs")
        .update({ current_phase: "multi_tf_bars", progress_pct: 8 })
        .eq("id", job.id);
      try {
        const loaded = await Promise.all(
          higherTfs.map(async (tf) => {
            const tfBars = await loadHistoricalBars(supabase, cfg.symbol, tf, cfg.from, cfg.to);
            return [tf, tfBars] as const;
          }),
        );
        const map = new Map<string, typeof bars>();
        const skipped: string[] = [];
        for (const [tf, tfBars] of loaded) {
          if (tfBars.length >= 50) map.set(tf, tfBars);
          else skipped.push(`${tf}(${tfBars.length}b)`);
        }
        if (map.size === 0) {
          multiTfLoadError = `no higher-TF bars loaded (skipped: ${skipped.join(", ") || "all empty"})`;
        } else {
          cfg.multiTfBars = map;
          if (skipped.length > 0) logWarn("BacktestWorker", `Multi-TF skipped sparse TFs: ${skipped.join(", ")}`, { component: "run-job", meta: { jobId: job.id } });
        }
      } catch (loadErr) {
        multiTfLoadError = loadErr instanceof Error ? loadErr.message : String(loadErr);
        logWarn("BacktestWorker", `Multi-TF bar load failed: ${multiTfLoadError}`, { component: "run-job", meta: { jobId: job.id } });
      }
    }

    const result = await runFullBacktest(bars, cfg, async ({ phase, pct }) => {
      await supabase
        .from("backtest_jobs")
        .update({ current_phase: phase, progress_pct: pct })
        .eq("id", job.id);
    });

    // Multi-TF wiring upgrade (Gap #4). When useMultiTf is true, the engine
    // attached multiTfStats to result.baseline. We replace the orchestrator's
    // 'pending' block with 'completed' (or 'failed' if bar loading produced
    // nothing usable).
    let advanced: AdvancedPipeline | null = result.advanced;
    if (advanced && advanced.multiTf?.status === 'pending') {
      const higherTimeframes = advanced.multiTf.higherTimeframes;
      if (multiTfLoadError) {
        advanced = {
          ...advanced,
          multiTf: { used: true, status: 'failed', higherTimeframes, reason: multiTfLoadError },
        };
      } else if (result.baseline.multiTfStats) {
        advanced = {
          ...advanced,
          multiTf: {
            used:                true,
            status:              'completed',
            higherTimeframes,
            tradesFilteredCount: result.baseline.multiTfStats.tradesFilteredCount,
            alignment:           result.baseline.multiTfStats.alignment,
          },
        };
      } else {
        // Engine didn't fill stats — means cfg.multiTfBars was never set
        // (defensive; shouldn't happen if we reach here without an error).
        advanced = {
          ...advanced,
          multiTf: { used: true, status: 'failed', higherTimeframes, reason: 'engine did not produce multiTfStats' },
        };
      }
    }

    // Portfolio wiring (Plan v2 — Gap #2). The pure orchestrator surfaces
    // intent via advanced.portfolio.status='pending' because runPortfolio
    // needs a SupabaseClient. Here we replace that block with the real
    // multi-symbol result: clone cfg per leg substituting `symbol` and
    // scaling `initialBalance` by the leg's normalized weight. Failures
    // stay isolated — they downgrade portfolio to 'failed' without
    // breaking the baseline.
    if (advanced && advanced.portfolio?.status === 'pending') {
      const legsInput = cfg.portfolioLegs ?? [];
      if (legsInput.length >= 2) {
        await supabase
          .from("backtest_jobs")
          .update({ current_phase: "portfolio", progress_pct: 92 })
          .eq("id", job.id);
        try {
          const legs: PortfolioLeg[] = legsInput.map((leg) => ({
            configId: leg.configId,
            symbol:   leg.symbol,
            weight:   leg.weight,
            cfg: {
              ...cfg,
              symbol:         leg.symbol,
              initialBalance: cfg.initialBalance * leg.weight,
            },
          }));
          const portfolio = await runPortfolio(supabase, legs);
          advanced = {
            ...advanced,
            portfolio: {
              used:     true,
              status:   'completed',
              legCount: legs.length,
              metrics:  portfolio.metrics,
              equityPreviewLast50: portfolio.portfolioEquity.slice(-50),
            },
          };
          logInfo("BacktestWorker", "portfolio completed", {
            component: "run-job",
            meta: { jobId: job.id, legCount: legs.length, sharpe: portfolio.metrics.sharpe },
          });
        } catch (portErr) {
          const portMsg = portErr instanceof Error ? portErr.message : String(portErr);
          advanced = {
            ...advanced,
            portfolio: { used: true, status: 'failed', reason: portMsg.slice(0, 200) },
          };
          result.warnings.push(`portfolio: ${portMsg}`);
          logWarn("BacktestWorker", "portfolio failed", {
            component: "run-job",
            meta: { jobId: job.id, message: portMsg },
          });
        }
      } else {
        advanced = {
          ...advanced,
          portfolio: {
            used:   true,
            status: 'failed',
            reason: `portfolioLegs requires at least 2 legs; got ${legsInput.length}`,
          },
        };
      }
    }

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
      advanced,
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

    // Auto-recompute quality gates so the user sees fresh pass/fail breakdown
    // without manual recompute, and so promote-to-live can succeed immediately
    // after a successful backtest.
    if (job.algorithm_id) {
      try {
        const score = await computeGates(supabase, job.algorithm_id, job.user_id);
        logInfo("BacktestWorker", "quality gates recomputed", {
          component: "run-job",
          meta: { jobId: job.id, algorithm_id: job.algorithm_id, gates_passed: score.score.gates_passed, tier: score.score.tier },
        });
      } catch (gateErr) {
        const msg = gateErr instanceof Error ? gateErr.message : String(gateErr);
        logError("BacktestWorker", { component: "auto-recompute-gates", message: msg, meta: { jobId: job.id, algorithm_id: job.algorithm_id } });
      }
    }
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
