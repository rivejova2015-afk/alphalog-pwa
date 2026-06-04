// Duplicate an existing algorithm so the user can iterate on a variant without
// losing the original. Used by the "Duplicar algo" button in the details modal.
//
// The clone preserves all configuration (parameters, engine_config, market_type,
// platform, instrument, default_backtest_balance) but resets operational state
// to a draft research mode:
//   - status = 'draft'
//   - linked_bot_account_id = null
//   - pnl_*, win_rate, trade_count, profit_factor, drawdowns = 0
//   - last_dispatch_* = null
// Name gets " (copia)" appended (and "(copia 2)", "(copia 3)" if collisions).
//
// Auth: owner-only via RLS + explicit user_id filter.
// Rate-limit: 30 per hour (cheaper than create — no engine_config validation).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function uniqueCopyName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  baseName: string,
): Promise<string> {
  // Find existing names that look like "<base> (copia)" or "<base> (copia N)"
  // to avoid collisions when duplicating the same algo multiple times.
  const { data } = await supabase
    .from("algorithms")
    .select("name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .ilike("name", `${baseName} (copia%`);

  const existing = new Set((data ?? []).map((row: { name: string }) => row.name));
  const candidate = `${baseName} (copia)`;
  if (!existing.has(candidate)) return candidate;

  for (let n = 2; n < 1000; n++) {
    const next = `${baseName} (copia ${n})`;
    if (!existing.has(next)) return next;
  }
  // Fallback so we never loop forever — extremely unlikely (1000+ copies).
  return `${baseName} (copia ${Date.now()})`;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkAiRateLimit(user.id, "algo-duplicate", 30);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600), "X-RateLimit-Limit": "30" },
      });
    }

    // Pull the source row in full so we can clone its config verbatim.
    const { data: source, error: srcErr } = await supabase
      .from("algorithms")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (srcErr || !source) {
      return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });
    }

    const newName = await uniqueCopyName(supabase, user.id, source.name as string);

    // Reset operational + lifecycle state; preserve config and the persisted
    // default_backtest_balance so the copy starts where the original left off
    // for research purposes.
    const clonePayload = {
      user_id:               user.id,
      name:                  newName,
      instrument:            source.instrument,
      market_type:           source.market_type,
      direction:             source.direction,
      platform:              source.platform,
      status:                "draft",
      linked_bot_account_id: null,
      lot_size:              source.lot_size,
      max_trades:            source.max_trades,
      risk_percent:          source.risk_percent,
      parameters:            source.parameters ?? {},
      engine_config:         source.engine_config,
      scan_config:           source.scan_config ?? {},
      default_backtest_balance: source.default_backtest_balance ?? null,
      // Operational metrics start fresh.
      pnl_today:             0,
      pnl_total:             0,
      win_rate:              0,
      trade_count:           0,
      profit_factor:         0,
      drawdown_pct:          0,
      max_drawdown_pct:      0,
    };

    const { data: created, error: insertErr } = await supabase
      .from("algorithms")
      .insert(clonePayload)
      .select("id, name, status")
      .single();

    if (insertErr || !created) {
      logError("Algorithms", { component: "POST duplicate", message: insertErr?.message ?? "unknown" });
      return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "algorithm", resourceId: created.id, status: "success" },
      request,
    );

    return NextResponse.json({ algorithm: created }, { status: 201 });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/duplicate", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
