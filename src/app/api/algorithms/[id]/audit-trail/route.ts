// GET /api/algorithms/[id]/audit-trail — audit timeline for one algorithm
// (Wave 5 item 23).
//
// Reads audit_logs directly (not the get_user_audit_logs RPC — that RPC
// only filters by action/resource_type, not resource_id, so it can't scope
// to a single algorithm without over-fetching). RLS already restricts
// audit_logs to `user_id = auth.uid()` (migration 054), so this is a plain
// scoped select via the session-bound client, same pattern as every other
// route in this module.
//
// Known limitation (documented, not fixed here — see Wave 5 item 23 audit):
// two routes (engine-backtest/runs and runs/[runId]) log resourceType
// "algorithm" with resourceId set to a backtest RUN id in one of the two
// cases, not the algorithm id. Those entries won't show up here since we
// filter strictly on resource_id = algorithm id. Fixing that inconsistency
// would mean touching those routes' audit semantics, out of scope for a
// read-only timeline endpoint.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, resource_type, changes, status, error_message, created_at")
      .eq("user_id", user.id)
      .in("resource_type", ["algorithm", "algorithm_deployment"])
      .eq("resource_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      logError("Algorithms", { component: "GET /api/algorithms/[id]/audit-trail", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data ?? [] }, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (err) {
    logError("Algorithms", { component: "GET /api/algorithms/[id]/audit-trail", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
