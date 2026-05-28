import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { treasuryTransactionUpdateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT /api/treasury/transactions/[id] — edit an existing transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(treasuryTransactionUpdateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    // Verify ownership
    const { data: existing, error: ownErr } = await supabase
      .from("treasury_transactions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (ownErr || !existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    // If account_id provided, verify ownership
    if (result.data.account_id) {
      const { data: account, error: acctErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("id", result.data.account_id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (acctErr || !account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (result.data.type !== undefined) patch.type = result.data.type;
    if (result.data.amount !== undefined) patch.amount = result.data.amount;
    if (result.data.occurred_on !== undefined) patch.occurred_on = result.data.occurred_on;
    if (result.data.description !== undefined) patch.description = result.data.description;
    if (result.data.notes !== undefined) patch.notes = result.data.notes;
    if (result.data.account_id !== undefined) patch.account_id = result.data.account_id;

    const { data, error } = await supabase
      .from("treasury_transactions")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) {
      logError("Treasury", { component: "PUT /api/treasury/transactions/[id]", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "update",
        resourceType: "treasury_transaction",
        resourceId: id,
        status: "success",
        changes: patch,
      },
      request
    );

    return NextResponse.json({ transaction: data });
  } catch (err) {
    logError("Treasury", { component: "PUT /api/treasury/transactions/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/treasury/transactions/[id] — soft-delete a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const nowIso = new Date().toISOString();
    const { error, count } = await supabase
      .from("treasury_transactions")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("Treasury", { component: "DELETE /api/treasury/transactions/[id]", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    if (!count) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    await logAuditFromRequest(
      {
        userId: user.id,
        action: "delete",
        resourceType: "treasury_transaction",
        resourceId: id,
        status: "success",
      },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("Treasury", { component: "DELETE /api/treasury/transactions/[id]", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
