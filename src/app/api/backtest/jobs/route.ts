import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;

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

const QSTASH_PUBLISH = "https://qstash.upstash.io/v2/publish/";

async function publishToQStash(workerUrl: string, payload: unknown): Promise<boolean> {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return false;
  const r = await fetch(QSTASH_PUBLISH + encodeURIComponent(workerUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Retries": "0",
    },
    body: JSON.stringify(payload),
  });
  return r.ok;
}

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

    const appUrl = process.env.ALPHALOG_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get("host")}`;
    const workerUrl = `${appUrl}/api/backtest/worker`;
    const enqueued = await publishToQStash(workerUrl, { job_id: job.id });

    if (!enqueued) {
      // Fallback: fire-and-forget HTTP call so the run still happens (best effort).
      fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-trigger": process.env.CRON_SECRET ?? "" },
        body: JSON.stringify({ job_id: job.id }),
      }).catch(() => {});
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    logError("BacktestJobs", { component: "POST /api/backtest/jobs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const algorithmId = request.nextUrl.searchParams.get("algorithm_id");
    const limit = Math.min(50, Number(request.nextUrl.searchParams.get("limit") ?? "20"));

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
