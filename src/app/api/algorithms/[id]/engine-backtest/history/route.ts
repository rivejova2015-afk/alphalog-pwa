// History of engine v1 backtest runs for a given algorithm.
// Used by EngineBacktestPanel to let the user re-load a previous run instead
// of recomputing (which would be wasteful and also non-deterministic for
// monte carlo).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/algorithms/[id]/engine-backtest/history?limit=20
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? "20", 10) || 20));

    const { data, error } = await supabase
      .from("engine_backtest_runs")
      .select("id, symbol, range_from, range_to, params, baseline_metrics, final_balance, total_trades, duration_ms, monte_carlo, walk_forward, bars_loaded, created_at")
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logError("EngineBacktestHistory", { component: "GET history", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ runs: data ?? [] }, {
      status: 200,
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    logError("EngineBacktestHistory", { component: "GET history", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
