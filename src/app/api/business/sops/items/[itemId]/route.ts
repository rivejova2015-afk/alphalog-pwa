import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/business/sops/items/[itemId] — soft-delete a SOP checklist item
// Note: this path is `/sops/items/[itemId]` (not `/sops/[id]/items/[itemId]`)
// so the panel can delete without knowing the parent SOP id ahead of time.
// Ownership is verified via user_id on the row itself.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { itemId } = await params;
    const nowIso = new Date().toISOString();

    const { error, count } = await supabase
      .from("business_sop_items")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", itemId)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("BusinessAPI", { component: "DELETE sop item", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    if (!count) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "business_sop", resourceId: itemId, status: "success" },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BusinessAPI", { component: "DELETE sop item", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
