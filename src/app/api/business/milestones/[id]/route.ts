import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessMilestoneUpdateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/business/milestones/[id] — change status/title/etc.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessMilestoneUpdateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ["title", "description", "target_date", "status", "goal_id", "notes"] as const) {
      if (result.data[k] !== undefined) patch[k] = result.data[k];
    }

    const { data, error } = await supabase
      .from("business_milestones")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PUT /api/business/milestones/[id]", message: error?.message ?? "not found" });
      return NextResponse.json({ error: "Update failed" }, { status: error?.code === "PGRST116" ? 404 : 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_milestone", resourceId: id, status: "success", changes: patch },
      request
    );

    return NextResponse.json({ milestone: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PUT /api/business/milestones/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/business/milestones/[id] — soft-delete
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const nowIso = new Date().toISOString();

    const { error, count } = await supabase
      .from("business_milestones")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("BusinessAPI", { component: "DELETE /api/business/milestones/[id]", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    if (!count) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "business_milestone", resourceId: id, status: "success" },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BusinessAPI", { component: "DELETE /api/business/milestones/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
