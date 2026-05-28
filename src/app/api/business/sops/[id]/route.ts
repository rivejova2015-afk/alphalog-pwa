import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessSOPUpdateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/business/sops/[id] — update SOP fields (title, type, content)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessSOPUpdateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (result.data.title !== undefined) patch.title = result.data.title;
    if (result.data.type !== undefined) patch.type = result.data.type;
    if (result.data.content !== undefined) patch.content = result.data.content;

    const { data, error } = await supabase
      .from("business_sops")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PUT /api/business/sops/[id]", message: error?.message ?? "not found" });
      return NextResponse.json({ error: "Update failed" }, { status: error?.code === "PGRST116" ? 404 : 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_sop", resourceId: id, status: "success", changes: patch },
      request
    );

    return NextResponse.json({ sop: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PUT /api/business/sops/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/business/sops/[id] — soft-delete SOP + items + runs + run_items
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const nowIso = new Date().toISOString();

    const { error, count } = await supabase
      .from("business_sops")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("BusinessAPI", { component: "DELETE /api/business/sops/[id]", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    if (!count) return NextResponse.json({ error: "SOP not found" }, { status: 404 });

    // Cascade soft-delete: items + runs + run_items
    await supabase
      .from("business_sop_items")
      .update({ deleted_at: nowIso, updated_at: nowIso })
      .eq("sop_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const { data: runs } = await supabase
      .from("business_sop_runs")
      .select("id")
      .eq("sop_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (runs && runs.length > 0) {
      const runIds = runs.map((r) => r.id);
      await supabase
        .from("business_sop_runs")
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .in("id", runIds)
        .eq("user_id", user.id);
      await supabase
        .from("business_sop_run_items")
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .in("run_id", runIds)
        .eq("user_id", user.id)
        .is("deleted_at", null);
    }

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "business_sop", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BusinessAPI", { component: "DELETE /api/business/sops/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
