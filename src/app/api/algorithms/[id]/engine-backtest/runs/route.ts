// Bulk-delete engine_backtest_runs. Two modes:
//   - DELETE /api/algorithms/[id]/engine-backtest/runs            → clear ALL
//   - DELETE /api/algorithms/[id]/engine-backtest/runs?ids=a,b,c  → only those ids
//
// Both are hard-deletes — `engine_backtest_runs` has no soft-delete column
// by design (the user wants noise gone, not hidden). RLS already enforces
// ownership; the .eq("user_id") + .eq("algorithm_id") below are defense
// in depth.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError, logInfo } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Optional explicit id list — comma-separated UUIDs in the query string.
    // Empty / missing → clear-all for this algorithm.
    const idsRaw = request.nextUrl.searchParams.get("ids");
    const explicitIds = idsRaw
      ? idsRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : null;

    // Count first so we can report meaningfully (and bail early on noop).
    const countQ = supabase
      .from("engine_backtest_runs")
      .select("id", { count: "exact", head: true })
      .eq("algorithm_id", id)
      .eq("user_id", user.id);
    if (explicitIds && explicitIds.length > 0) countQ.in("id", explicitIds);
    const { count, error: countErr } = await countQ;
    if (countErr) {
      logError("EngineBacktestBulkDelete", { component: "count", message: countErr.message });
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    const target = count ?? 0;
    if (target === 0) {
      return NextResponse.json({ ok: true, deleted: 0, mode: explicitIds ? "selected" : "all" }, { status: 200 });
    }

    const deleteQ = supabase
      .from("engine_backtest_runs")
      .delete()
      .eq("algorithm_id", id)
      .eq("user_id", user.id);
    if (explicitIds && explicitIds.length > 0) deleteQ.in("id", explicitIds);
    const { error: deleteErr } = await deleteQ;
    if (deleteErr) {
      logError("EngineBacktestBulkDelete", { component: "delete", message: deleteErr.message });
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    await logAuditFromRequest({
      userId:       user.id,
      action:       "delete",
      resourceType: "algorithm",
      resourceId:   id,
      changes:      { algorithm_id: id, deleted_count: target, mode: explicitIds ? "selected" : "all", ids: explicitIds?.slice(0, 50) },
      status:       "success",
    }, request);

    logInfo("EngineBacktestBulkDelete", `deleted ${target} runs for algo ${id} (mode=${explicitIds ? "selected" : "all"})`);
    return NextResponse.json({ ok: true, deleted: target, mode: explicitIds ? "selected" : "all" }, { status: 200 });
  } catch (err) {
    logError("EngineBacktestBulkDelete", { component: "DELETE", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
