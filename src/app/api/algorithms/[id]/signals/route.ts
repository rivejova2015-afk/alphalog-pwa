// GET /api/algorithms/[id]/signals?limit=50&status=skipped
//
// Returns the dispatcher's recent decisions for this algorithm — the audit
// trail the user reads from the Shadow Inbox UI to validate what shadow
// mode would have traded before flipping DISPATCH_MODE=live.
//
// Status filter values mirror cme_signals.status:
//   - 'pending'   (mid-dispatch, ephemeral)
//   - 'executing' (between order placement and confirmation)
//   - 'executed'  (live mode, order placed and persisted to cme_trades_propfirm)
//   - 'rejected'  (executor returned failure)
//   - 'skipped'   (shadow mode → reject_reason='shadow_mode',
//                  OR position-aware → 'already_long'/'already_short')
//
// Default returns the most recent 50 regardless of status — gives the user
// a full feed of dispatcher activity in one fetch.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const VALID_STATUSES = new Set(["pending", "executing", "executed", "rejected", "skipped"]);

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ownership check — defense in depth. RLS already enforces this; the
    // explicit query lets us return 404 instead of leaking an empty list.
    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw ?? "50", 10) || 50));

    const statusRaw = request.nextUrl.searchParams.get("status");
    const statusFilter = statusRaw && VALID_STATUSES.has(statusRaw) ? statusRaw : null;

    let q = supabase
      .from("cme_signals")
      .select("id, algorithm_id, cme_account_id, contract, direction, signal_type, quantity, stop_loss_ticks, take_profit_ticks, status, reject_reason, created_at, executed_at")
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (statusFilter) q = q.eq("status", statusFilter);

    const { data, error } = await q;
    if (error) {
      logError("AlgoSignals", { component: "GET signals", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ signals: data ?? [] }, {
      status: 200,
      headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
    });
  } catch (err) {
    logError("AlgoSignals", { component: "GET signals", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
