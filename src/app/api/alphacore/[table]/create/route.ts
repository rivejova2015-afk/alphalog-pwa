// src/app/api/alphacore/[table]/create/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { encryptText } from "@/lib/security/encryption";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { z } from "zod";
import { logError } from "@/lib/log";

/**
 * Whitelist of tables allowed for AlphaCore offline sync mutations.
 * Only these tables can be targeted by the generic create/update/delete endpoints.
 */
const ALLOWED_TABLES = ["trades", "journal_entries", "accounts"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function isAllowedTable(table: string): table is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(table);
}

/**
 * Fields that require server-side AES-256-GCM encryption before storage.
 * Keyed by table name.
 */
const ENCRYPTED_FIELDS: Record<AllowedTable, string[]> = {
  trades: ["notes"],
  journal_entries: ["content", "title"],
  accounts: [],
};

/**
 * Zod schema for the create request body.
 * The outbox sends { payload, metadata?, outboxId? }.
 */
const createBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  outboxId: z.string().optional(),
});

/**
 * POST /api/alphacore/[table]/create
 *
 * Generic create endpoint for AlphaCore offline-first mutations.
 * Inserts a new row into the specified table via Supabase (anon key + RLS).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;

    // 1. Validate table against whitelist
    if (!isAllowedTable(table)) {
      return NextResponse.json(
        { error: "Invalid table", message: `Table "${table}" is not allowed` },
        { status: 400 }
      );
    }

    // 2. Verify session
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userData.user.id;

    // 3. Parse and validate body
    const rawBody = await request.json();
    const bodyResult = createBodySchema.safeParse(rawBody);

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

    const { payload, outboxId } = bodyResult.data;

    // 4. Idempotency check: if outboxId is provided and the payload contains
    //    a temp ID that was already replaced, skip the duplicate insert.
    //    We use a lightweight check: look for an existing row created by the
    //    same user within a short window that matches key fields.
    if (outboxId && payload.id && typeof payload.id === "string" && !payload.id.startsWith("temp_")) {
      const { data: existing } = await supabase
        .from(table)
        .select("id")
        .eq("id", payload.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        // Already synced -- return the existing record for idempotency
        return NextResponse.json({
          success: true,
          data: existing,
          idempotent: true,
        });
      }
    }

    // 5. Build the insert payload
    //    - Always set user_id from the session (never trust client)
    //    - Strip fields the client should not set directly
    //    - Encrypt sensitive fields
    const insertPayload: Record<string, unknown> = { ...payload };

    // Force user_id from session
    insertPayload.user_id = userId;

    // Strip temp IDs so Supabase generates a real UUID
    if (
      typeof insertPayload.id === "string" &&
      (insertPayload.id as string).startsWith("temp_")
    ) {
      delete insertPayload.id;
    }

    // Strip server-managed timestamps (let the DB set them)
    delete insertPayload.created_at;
    delete insertPayload.updated_at;
    delete insertPayload.deleted_at;

    // Encrypt sensitive fields
    const fieldsToEncrypt = ENCRYPTED_FIELDS[table];
    for (const field of fieldsToEncrypt) {
      if (insertPayload[field] && typeof insertPayload[field] === "string") {
        insertPayload[field] = encryptText(insertPayload[field] as string);
      }
    }

    // 6. Insert
    const { data, error } = await supabase
      .from(table)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      logError("AlphaCore", { component: "alphacore.[table].create", message: `Error creating ${table}:: ${error instanceof Error ? error.message : String(error)}` });
      await recordBugFromRequest(request, {
        userId,
        status: 500,
        error,
        payload: { table, outboxId },
      });
      return NextResponse.json(
        { error: "Failed to create record", message: error.message },
        { status: 500 }
      );
    }

    // 7. Audit log (fire and forget)
    logAuditFromRequest(
      {
        userId,
        action: "create",
        resourceType: table === "trades" ? "trade" : table === "journal_entries" ? "journal" : "account",
        resourceId: data.id,
        changes: { source: "alphacore_offline", outboxId },
      },
      request
    ).catch((e) => console.warn("[Audit] Failed to log alphacore create:", e));

    // 8. Return the created record
    return NextResponse.json({
      success: true,
      data: { id: data.id, ...data },
    });
  } catch (err: unknown) {
    logError("AlphacoreCreate", { component: "alphacore.[table].create", message: "Error in POST /api/alphacore/[table]/create:", error: err instanceof Error ? err.message : String(err) });
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
