// src/app/api/alphacore/[table]/[id]/delete/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { logError, logWarn } from "@/lib/log";

/**
 * Whitelist of tables allowed for AlphaCore offline sync mutations.
 */
const ALLOWED_TABLES = ["trades", "journal_entries", "accounts"] as const;

function isAllowedTable(table: string): table is (typeof ALLOWED_TABLES)[number] {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}

/**
 * DELETE /api/alphacore/[table]/[id]/delete
 *
 * Generic soft-delete endpoint for AlphaCore offline-first mutations.
 * Sets deleted_at on the specified row via Supabase (anon key + RLS).
 * Never performs a physical DELETE -- soft-delete only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string; id: string }> }
) {
  try {
    const { table, id } = await params;

    // 1. Validate table against whitelist
    if (!isAllowedTable(table)) {
      return NextResponse.json(
        { error: "Invalid table", message: `Table "${table}" is not allowed` },
        { status: 400 }
      );
    }

    // 2. Validate id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: "Invalid ID", message: "ID must be a valid UUID" },
        { status: 400 }
      );
    }

    // 3. Verify session
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 4. Soft-delete: set deleted_at (never physical DELETE)
    const { data, error } = await supabase
      .from(table)
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .is("deleted_at", null) // Only delete if not already deleted
      .select("id")
      .single();

    if (error) {
      logError("AlphaCore", { component: "alphacore.[table].[id].delete", message: `Error deleting ${table}/${id}:: ${error instanceof Error ? error.message : String(error)}` });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error,
        payload: { table, id },
      });
      return NextResponse.json(
        { error: "Failed to delete record", message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      // Record not found or already deleted -- treat as success for idempotency
      return NextResponse.json({
        success: true,
        data: { id },
        idempotent: true,
      });
    }

    // 5. Audit log (fire and forget)
    logAuditFromRequest(
      {
        userId,
        action: "delete",
        resourceType: table === "trades" ? "trade" : table === "journal_entries" ? "journal" : "account",
        resourceId: id,
        changes: { source: "alphacore_offline", soft_delete: true },
      },
      request
    ).catch((e) => logWarn("Alphacore", "Failed to log alphacore delete", { component: "alphacore.delete.audit", error: e instanceof Error ? e.message : String(e) }));

    // 6. Return success
    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (err: unknown) {
    logError("AlphacoreDelete", { component: "alphacore.[table].[id].delete", message: "Error in DELETE /api/alphacore/[table]/[id]/delete:", error: err instanceof Error ? err.message : String(err) });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error: err,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
