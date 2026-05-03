import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const deploySchema = z.object({
  bot_account_ids: z.array(z.string().uuid()).min(1),
  notes: z.string().max(300).optional(),
});

// POST /api/algorithms/[id]/deploy
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkAiRateLimit(user.id, "algo-deploy", 10);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600), "X-RateLimit-Limit": "10" },
      });
    }

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = deploySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });

    // Algorithm must be approved or live
    const { data: algo } = await supabase
      .from("trading_algorithms")
      .select("id, status, platform")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!algo) return NextResponse.json({ error: "Algoritmo no encontrado" }, { status: 404 });
    if (!["approved", "live"].includes(algo.status)) {
      return NextResponse.json({ error: "El algoritmo debe estar Aprobado antes de desplegarse" }, { status: 409 });
    }

    // Verify user owns all requested bot_accounts
    const { data: ownedAccounts } = await supabase
      .from("bot_accounts")
      .select("id")
      .eq("user_id", user.id)
      .in("id", parsed.data.bot_account_ids);

    const ownedIds = new Set((ownedAccounts ?? []).map((a) => a.id));
    const unauthorized = parsed.data.bot_account_ids.filter((id) => !ownedIds.has(id));
    if (unauthorized.length > 0) {
      return NextResponse.json({ error: "Una o más cuentas no pertenecen al usuario" }, { status: 403 });
    }

    const rows = parsed.data.bot_account_ids.map((bot_account_id) => ({
      user_id: user.id,
      algorithm_id: id,
      bot_account_id,
      status: "active",
      notes: parsed.data.notes ?? null,
    }));

    const { data, error } = await supabase
      .from("algorithm_deployments")
      .upsert(rows, { onConflict: "algorithm_id,bot_account_id", ignoreDuplicates: false })
      .select("*, bot_accounts(label, account_id)");

    if (error) {
      logError("Algorithms", { component: "POST deploy", message: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark algorithm as live
    await supabase
      .from("trading_algorithms")
      .update({ status: "live" })
      .eq("id", id)
      .eq("user_id", user.id);

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "algorithm_deployment", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json({ ok: true, deployments: data });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/deploy", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/algorithms/[id]/deploy?bot_account_id=xxx  (stop a specific deployment)
export async function DELETE(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const botAccountId = request.nextUrl.searchParams.get("bot_account_id");

    let query = supabase
      .from("algorithm_deployments")
      .update({ status: "stopped", stopped_at: new Date().toISOString() })
      .eq("algorithm_id", id)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (botAccountId) query = query.eq("bot_account_id", botAccountId);

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If no active deployments remain, revert to approved
    const { count } = await supabase
      .from("algorithm_deployments")
      .select("id", { count: "exact", head: true })
      .eq("algorithm_id", id)
      .eq("status", "active");

    if ((count ?? 0) === 0) {
      await supabase
        .from("trading_algorithms")
        .update({ status: "approved" })
        .eq("id", id)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Algorithms", { component: "DELETE /api/algorithms/[id]/deploy", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
