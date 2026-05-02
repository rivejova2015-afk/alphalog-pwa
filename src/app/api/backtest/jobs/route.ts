import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runBacktestJob } from "@/lib/backtest/run-job";
import { logError, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
const STUCK_QUEUED_MS = 30_000; // a job queued > 30s with no started_at is treated as zombie
const STUCK_RUNNING_MS = 6 * 60 * 1000; // a job running > 6 min is dead (maxDuration is 5)

const indicatorRefSchema = z.object({
  type: z.enum(["sma", "ema", "rsi", "atr", "bb_upper", "bb_lower", "macd", "price"]),
  period: z.number().int().positive().optional(),
  field: z.enum(["open", "high", "low", "close"]).optional(),
  shift: z.number().int().min(0).max(50).optional(),
});

const conditionSchema = z.object({
  left: z.union([indicatorRefSchema, z.number()]),
  op: z.enum([">", "<", ">=", "<=", "==", "cross_above", "cross_below"]),
  right: z.union([indicatorRefSchema, z.number()]),
});

const rulesSchema = z.object({
  entryLong: z.array(conditionSchema).optional(),
  entryShort: z.array(conditionSchema).optional(),
  exitLong: z.array(conditionSchema).optional(),
  exitShort: z.array(conditionSchema).optional(),
  slPoints: z.number().nonnegative().optional(),
  tpPoints: z.number().nonnegative().optional(),
  sizing: z.object({
    mode: z.enum(["fixed_lot", "risk_pct", "kelly"]),
    value: z.number().positive(),
    riskPerTradePct: z.number().positive().optional(),
  }),
  maxConcurrent: z.number().int().min(1).max(20).optional(),
});

const configSchema = z.object({
  algorithmId: z.string().uuid().optional(),
  symbol: z.string().min(1).max(32),
  timeframe: z.enum(TIMEFRAMES),
  from: z.string(),
  to: z.string(),
  initialBalance: z.number().positive(),
  contractSize: z.number().positive(),
  pointValue: z.number().positive(),
  spreadPoints: z.number().nonnegative(),
  commissionPerLot: z.number().nonnegative(),
  slippagePoints: z.number().nonnegative(),
  direction: z.enum(["long", "short", "both"]),
  parameters: z.record(z.string(), z.unknown()).default({}),
  rules: rulesSchema,
  monteCarloIterations: z.number().int().min(0).max(10000).optional(),
  walkForwardWindows: z.number().int().min(0).max(20).optional(),
  stressTests: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const cfg = parsed.data;

    if (new Date(cfg.from) >= new Date(cfg.to)) {
      return NextResponse.json({ error: "from must be earlier than to" }, { status: 400 });
    }

    const svc = createServiceClient();
    const { data: job, error } = await svc
      .from("backtest_jobs")
      .insert({
        user_id: user.id,
        algorithm_id: cfg.algorithmId ?? null,
        status: "queued",
        config: cfg,
        progress_pct: 0,
        current_phase: "queued",
      })
      .select("id, status, created_at")
      .single();

    if (error || !job) {
      logError("BacktestJobs", { component: "POST /api/backtest/jobs", message: error?.message ?? "insert failed" });
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
    }

    // Run the backtest INLINE in the same request. This is the most reliable
    // pattern on Vercel — fire-and-forget gets killed and after() may be
    // limited on Hobby plans. The client polls for progress and will see the
    // job transition queued → running → completed before this response returns.
    try {
      await runBacktestJob(svc, job.id);
    } catch (err) {
      logError("BacktestJobs", { component: "inline runBacktestJob", message: String(err), meta: { jobId: job.id } });
      // runBacktestJob already records status='failed' in the DB on error.
    }

    // Return the latest job state so the UI doesn't wait for the next poll.
    const { data: finalJob } = await svc
      .from("backtest_jobs")
      .select("id, status, progress_pct, current_phase, error, created_at, started_at, finished_at")
      .eq("id", job.id)
      .maybeSingle();

    return NextResponse.json({ job: finalJob ?? job }, { status: 201 });
  } catch (err) {
    logError("BacktestJobs", { component: "POST /api/backtest/jobs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Watchdog: failure-quarantine for jobs that never progressed (worker died
// mid-flight on a previous deploy/timeout). Keeps the UI informative instead
// of leaving rows hanging forever.
async function reapZombies(svc: ReturnType<typeof createServiceClient>, userId: string, algorithmId: string | null) {
  const cutoffQueued  = new Date(Date.now() - STUCK_QUEUED_MS).toISOString();
  const cutoffRunning = new Date(Date.now() - STUCK_RUNNING_MS).toISOString();

  let q1 = svc.from("backtest_jobs")
    .update({ status: "failed", error: "Worker timed out before starting. Re-run.", finished_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "queued")
    .lt("created_at", cutoffQueued);
  if (algorithmId) q1 = q1.eq("algorithm_id", algorithmId);
  const r1 = await q1;
  if (r1.error) logWarn("BacktestJobs", "reap queued failed", { component: "reapZombies", meta: { message: r1.error.message } });

  let q2 = svc.from("backtest_jobs")
    .update({ status: "failed", error: "Worker exceeded max duration. Re-run with smaller scope.", finished_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "running")
    .lt("started_at", cutoffRunning);
  if (algorithmId) q2 = q2.eq("algorithm_id", algorithmId);
  const r2 = await q2;
  if (r2.error) logWarn("BacktestJobs", "reap running failed", { component: "reapZombies", meta: { message: r2.error.message } });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const algorithmId = request.nextUrl.searchParams.get("algorithm_id");
    const limit = Math.min(50, Number(request.nextUrl.searchParams.get("limit") ?? "20"));

    // Best-effort zombie reaper — runs after the response so polling stays fast.
    after(async () => {
      try {
        const svc = createServiceClient();
        await reapZombies(svc, user.id, algorithmId);
      } catch { /* best-effort, never throw */ }
    });

    let q = supabase
      .from("backtest_jobs")
      .select("id, algorithm_id, status, progress_pct, current_phase, error, created_at, started_at, finished_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (algorithmId) q = q.eq("algorithm_id", algorithmId);

    const { data, error } = await q;
    if (error) {
      logError("BacktestJobs", { component: "GET /api/backtest/jobs", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: data ?? [] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("BacktestJobs", { component: "GET /api/backtest/jobs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
