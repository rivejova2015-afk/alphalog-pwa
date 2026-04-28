import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { verifyQStashSignature } from "@/lib/qstash/verify";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runFullBacktest } from "@/lib/backtest/orchestrator";
import { logError, logInfo } from "@/lib/log";
import type { BacktestConfig } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ENGINE_VERSION = "v1";

function workerUrl(request: NextRequest): string {
  const base =
    process.env.ALPHALOG_WEB_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${request.headers.get("host")}`;
  return `${base.replace(/\/$/, "")}/api/backtest/worker`;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Auth: accept either QStash signature or internal trigger header (CRON_SECRET).
  const sig = request.headers.get("upstash-signature") ?? request.headers.get("Upstash-Signature");
  const internalTrigger = request.headers.get("x-internal-trigger") ?? "";
  let authorized = false;

  if (sig) {
    authorized = verifyQStashSignature(sig, rawBody, workerUrl(request));
  } else if (process.env.CRON_SECRET && internalTrigger) {
    authorized = safeCompareTokens(internalTrigger, process.env.CRON_SECRET);
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { job_id?: string } = {};
  try { payload = rawBody ? JSON.parse(rawBody) : {}; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.job_id) return NextResponse.json({ error: "Missing job_id" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: job, error: jobErr } = await supabase
    .from("backtest_jobs")
    .select("id, user_id, config, status")
    .eq("id", payload.job_id)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "queued") {
    return NextResponse.json({ ok: true, skipped: true, status: job.status });
  }

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
      return NextResponse.json({ ok: false, error: "insufficient_bars" }, { status: 200 });
    }

    logInfo("BacktestWorker", `Loaded ${bars.length} bars`, { component: "worker", meta: { jobId: job.id } });

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
    });

    await supabase
      .from("backtest_jobs")
      .update({
        status: "completed",
        progress_pct: 100,
        current_phase: "done",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("BacktestWorker", { component: "worker", message: msg, meta: { jobId: job.id } });
    await supabase
      .from("backtest_jobs")
      .update({
        status: "failed",
        error: msg.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
