import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessSOPItemCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/business/sops/[id]/items — append a checklist item to an existing SOP
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify SOP ownership
    const { data: sop } = await supabase
      .from("business_sops")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!sop) return NextResponse.json({ error: "SOP not found" }, { status: 404 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessSOPItemCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    // Append at the end (max sort_index + 1)
    const { data: maxRow } = await supabase
      .from("business_sop_items")
      .select("sort_index")
      .eq("sop_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSortIndex = ((maxRow?.sort_index as number | undefined) ?? -1) + 1;

    const { data, error } = await supabase
      .from("business_sop_items")
      .insert({
        user_id: user.id,
        sop_id: id,
        label: result.data.label,
        sort_index: nextSortIndex,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST sop item", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_sop", resourceId: data.id, status: "success",
        changes: { sop_id: id, label: data.label } },
      request
    );

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST sop item", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
