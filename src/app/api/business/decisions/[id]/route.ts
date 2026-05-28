import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessDecisionUpdateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/decisions/[id] — fetch a single decision with its tasks
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const [decisionRes, tasksRes] = await Promise.all([
      supabase
        .from("business_decisions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("business_decision_tasks")
        .select("*")
        .eq("decision_id", id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true }),
    ]);

    if (decisionRes.error) {
      logError("BusinessAPI", { component: "GET /api/business/decisions/[id]", message: decisionRes.error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }
    if (!decisionRes.data) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

    return NextResponse.json(
      { decision: decisionRes.data, tasks: tasksRes.data ?? [] },
      { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/decisions/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/business/decisions/[id] — partial update of decision fields
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessDecisionUpdateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ["title", "context", "decision", "rationale", "impact", "tags", "priority"] as const) {
      if (result.data[k] !== undefined) patch[k] = result.data[k];
    }

    const { data, error } = await supabase
      .from("business_decisions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PUT /api/business/decisions/[id]", message: error?.message ?? "not found" });
      return NextResponse.json({ error: "Update failed" }, { status: error?.code === "PGRST116" ? 404 : 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_decision", resourceId: id, status: "success", changes: patch },
      request
    );

    return NextResponse.json({ decision: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PUT /api/business/decisions/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/business/decisions/[id] — soft-delete; also soft-deletes tasks
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const nowIso = new Date().toISOString();

    const { error, count } = await supabase
      .from("business_decisions")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("BusinessAPI", { component: "DELETE /api/business/decisions/[id]", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    if (!count) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

    // Soft-delete child tasks too
    await supabase
      .from("business_decision_tasks")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("decision_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "business_decision", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BusinessAPI", { component: "DELETE /api/business/decisions/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
