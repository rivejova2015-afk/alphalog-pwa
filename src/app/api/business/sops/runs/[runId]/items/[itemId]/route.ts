import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessSOPRunItemPatchSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/business/sops/runs/[runId]/items/[itemId] — check/uncheck a single run item
// Note: [itemId] here refers to the `business_sop_run_items.id`, not the original `business_sop_items.id`.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string; itemId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId, itemId } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessSOPRunItemPatchSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: nowIso };
    if (result.data.checked !== undefined) {
      patch.checked = result.data.checked;
      patch.checked_at = result.data.checked ? nowIso : null;
    }
    if (result.data.note !== undefined) patch.note = result.data.note;

    const { data, error } = await supabase
      .from("business_sop_run_items")
      .update(patch)
      .eq("id", itemId)
      .eq("run_id", runId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PATCH run item", message: error?.message ?? "not found" });
      return NextResponse.json({ error: "Update failed" }, { status: error?.code === "PGRST116" ? 404 : 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_sop", resourceId: itemId, status: "success",
        changes: { ...patch, run_id: runId } },
      request
    );

    return NextResponse.json({ runItem: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PATCH run item", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
