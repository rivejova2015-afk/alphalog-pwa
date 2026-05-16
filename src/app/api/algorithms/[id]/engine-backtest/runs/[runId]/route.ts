// Hard-delete a single engine_backtest_runs row. The user explicitly
// requested manual control over the history (so failed/noisy runs don't
// pile up). RLS already enforces ownership; the extra .eq() filters are
// defense in depth in case RLS is bypassed during a future migration.
//
// No soft-delete column on engine_backtest_runs by design — the user wants
// the row gone, not hidden.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; runId: string }> };

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id, runId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify the run belongs to this algo + user before delete so we can
    // return a useful 404 instead of a silent no-op.
    const { data: existing, error: lookupErr } = await supabase
      .from("engine_backtest_runs")
      .select("id, symbol, total_trades")
      .eq("id", runId)
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupErr) {
      logError("EngineBacktestDelete", { component: "lookup", message: lookupErr.message });
      return NextResponse.json({ error: lookupErr.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const { error: deleteErr } = await supabase
      .from("engine_backtest_runs")
      .delete()
      .eq("id", runId)
      .eq("algorithm_id", id)
      .eq("user_id", user.id);

    if (deleteErr) {
      logError("EngineBacktestDelete", { component: "delete", message: deleteErr.message });
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    await logAuditFromRequest({
      userId:       user.id,
      action:       "delete",
      resourceType: "algorithm",
      resourceId:   runId,
      changes:      { algorithm_id: id, symbol: existing.symbol, total_trades: existing.total_trades },
      status:       "success",
    }, request);

    logInfo("EngineBacktestDelete", `deleted backtest run ${runId} for algo ${id}`);
    return NextResponse.json({ ok: true, deleted_id: runId }, { status: 200 });
  } catch (err) {
    logError("EngineBacktestDelete", { component: "DELETE", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
