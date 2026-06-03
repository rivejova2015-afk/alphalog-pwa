import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: job, error: jobErr } = await supabase
      .from("backtest_jobs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    let results = null;
    if (job.status === "completed") {
      const { data: r } = await supabase
        .from("backtest_results")
        .select("metrics, equity_curve, trades, monte_carlo, walk_forward, stress_tests, sensitivity, regime, robustness, advanced")
        .eq("job_id", id)
        .maybeSingle();
      results = r;
    }

    return NextResponse.json({ job, results }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("BacktestJobs", { component: "GET /api/backtest/jobs/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: job } = await supabase
      .from("backtest_jobs")
      .select("status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (job.status === "running" || job.status === "queued") {
      const { error } = await supabase
        .from("backtest_jobs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BacktestJobs", { component: "DELETE /api/backtest/jobs/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
