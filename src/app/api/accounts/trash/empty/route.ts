// src/app/api/accounts/trash/empty/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAuditFromRequest } from "@/lib/security/auditLog";

/**
 * POST /api/accounts/trash/empty
 * Hard-delete all soft-deleted accounts for user (permanent deletion)
 * Only deletes records where deleted_at IS NOT NULL
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // Hard-delete: use deleteMatch with filter
    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("user_id", userId)
      .not("deleted_at", "is", null);

    if (deleteError) {
      console.error("Error emptying trash:", deleteError);
      return NextResponse.json(
        { error: "Failed to empty trash" },
        { status: 500 }
      );
    }

    // Audit log: permanent deletion is a compliance-relevant event
    logAuditFromRequest(
      { userId, action: "delete", resourceType: "account", changes: { scope: "hard_delete_trash", permanent: true }, status: "success" },
      request,
    ).catch((e) => console.warn("[audit] empty trash log failed:", e));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Error in POST /api/accounts/trash/empty:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
