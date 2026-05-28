import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessSOPRunCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/sops/[id]/runs — list runs for a SOP (with their items joined)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const { data: runs, error: runsErr } = await supabase
      .from("business_sop_runs")
      .select("*")
      .eq("sop_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("run_date", { ascending: false })
      .limit(50);

    if (runsErr) {
      logError("BusinessAPI", { component: "GET runs", message: runsErr.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const runIds = (runs ?? []).map((r) => r.id);
    let runItems: unknown[] = [];
    if (runIds.length > 0) {
      const { data: items } = await supabase
        .from("business_sop_run_items")
        .select("*")
        .in("run_id", runIds)
        .eq("user_id", user.id)
        .is("deleted_at", null);
      runItems = items ?? [];
    }

    const itemsByRun = new Map<string, unknown[]>();
    for (const it of runItems) {
      const runId = (it as { run_id: string }).run_id;
      if (!itemsByRun.has(runId)) itemsByRun.set(runId, []);
      itemsByRun.get(runId)!.push(it);
    }

    const withItems = (runs ?? []).map((r) => ({ ...r, items: itemsByRun.get(r.id) ?? [] }));

    return NextResponse.json({ runs: withItems }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (err) {
    logError("BusinessAPI", { component: "GET runs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/sops/[id]/runs — start a new run; auto-creates run_items from current SOP items
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: unknown = {};
    try { body = await request.json(); } catch { /* allow empty body — use today */ }
    const todayStr = new Date().toISOString().slice(0, 10);
    const payload = typeof body === "object" && body !== null ? { run_date: todayStr, ...(body as Record<string, unknown>) } : { run_date: todayStr };

    const result = validatePayloadSafe(businessSOPRunCreateSchema, payload);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    // Verify ownership of SOP and fetch its items
    const { data: sop, error: sopErr } = await supabase
      .from("business_sops")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (sopErr || !sop) return NextResponse.json({ error: "SOP not found" }, { status: 404 });

    const { data: sopItems } = await supabase
      .from("business_sop_items")
      .select("id")
      .eq("sop_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    const { data: run, error: runErr } = await supabase
      .from("business_sop_runs")
      .insert({
        user_id: user.id,
        sop_id: id,
        run_date: result.data.run_date,
        notes: result.data.notes ?? null,
      })
      .select()
      .single();

    if (runErr || !run) {
      logError("BusinessAPI", { component: "POST run", message: runErr?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    let runItems: unknown[] = [];
    if (sopItems && sopItems.length > 0) {
      const rows = sopItems.map((it) => ({
        user_id: user.id,
        run_id: run.id,
        item_id: it.id,
        checked: false,
      }));
      const { data: items } = await supabase.from("business_sop_run_items").insert(rows).select();
      runItems = items ?? [];
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_sop", resourceId: run.id, status: "success",
        changes: { sop_id: id, run_date: run.run_date, item_count: runItems.length } },
      request
    );

    return NextResponse.json({ run: { ...run, items: runItems } }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST run", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
