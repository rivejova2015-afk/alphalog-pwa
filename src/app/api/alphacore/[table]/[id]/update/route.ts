// src/app/api/alphacore/[table]/[id]/update/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptText } from "@/lib/security/encryption";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { z } from "zod";
import { logError } from "@/lib/log";

/**
 * Whitelist of tables allowed for AlphaCore offline sync mutations.
 */
const ALLOWED_TABLES = ["trades", "journal_entries", "accounts"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function isAllowedTable(table: string): table is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}

/**
 * Fields that require server-side AES-256-GCM encryption before storage.
 */
const ENCRYPTED_FIELDS: Record<AllowedTable, string[]> = {
  trades: ["notes"],
  journal_entries: ["content", "title"],
  accounts: [],
};

/**
 * Zod schema for the update request body.
 * The outbox sends { payload, metadata?, outboxId? }.
 * The mutations.ts client sends { table, entityId, updates, metadata }.
 * We accept both shapes via a permissive schema.
 */
const updateBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  updates: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  outboxId: z.string().optional(),
}).refine(
  (data) => data.payload !== undefined || data.updates !== undefined,
  { message: "Either 'payload' or 'updates' must be provided" }
);

/**
 * PATCH /api/alphacore/[table]/[id]/update
 *
 * Generic update endpoint for AlphaCore offline-first mutations.
 * Updates an existing row in the specified table via Supabase (anon key + RLS).
 */
export async function PATCH(
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

    // 4. Parse and validate body
    const rawBody = await request.json();
    const bodyResult = updateBodySchema.safeParse(rawBody);

    if (!bodyResult.success) {
      const errors: Record<string, string> = {};
      bodyResult.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        errors[path || "root"] = issue.message;
      });
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // Accept both payload and updates keys (outbox sends payload, mutations.ts sends updates)
    const fields = bodyResult.data.payload ?? bodyResult.data.updates ?? {};

    // 5. Build update payload
    const updatePayload: Record<string, unknown> = { ...fields };

    // Never allow the client to change these fields
    delete updatePayload.id;
    delete updatePayload.user_id;
    delete updatePayload.created_at;

    // Set updated_at to now
    updatePayload.updated_at = new Date().toISOString();

    // Encrypt sensitive fields
    const fieldsToEncrypt = ENCRYPTED_FIELDS[table];
    for (const field of fieldsToEncrypt) {
      if (updatePayload[field] && typeof updatePayload[field] === "string") {
        updatePayload[field] = encryptText(updatePayload[field] as string);
      }
    }

    // 6. Update (RLS ensures user_id match)
    const { data, error } = await supabase
      .from(table)
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logError("AlphaCore", { component: "alphacore.[table].[id].update", message: `Error updating ${table}/${id}:: ${error instanceof Error ? error.message : String(error)}` });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error,
        payload: { table, id, outboxId: bodyResult.data.outboxId },
      });
      return NextResponse.json(
        { error: "Failed to update record", message: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Not found", message: `Record ${id} not found in ${table}` },
        { status: 404 }
      );
    }

    // 7. Audit log (fire and forget)
    logAuditFromRequest(
      {
        userId,
        action: "update",
        resourceType: table === "trades" ? "trade" : table === "journal_entries" ? "journal" : "account",
        resourceId: id,
        changes: { source: "alphacore_offline", fields: Object.keys(fields) },
      },
      request
    ).catch((e) => console.warn("[Audit] Failed to log alphacore update:", e));

    // 8. Return the updated record
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: unknown) {
    logError("AlphacoreUpdate", { component: "alphacore.[table].[id].update", message: "Error in PATCH /api/alphacore/[table]/[id]/update:", error: err instanceof Error ? err.message : String(err) });
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
