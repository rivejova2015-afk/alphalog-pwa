import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessLLCInboxCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/llc/inbox — list LLC inbox items (mail, IRS letters, etc.)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("llc_inbox_items")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("received_on", { ascending: false });

    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/llc/inbox", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { items: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/llc/inbox", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/llc/inbox — log a new inbox item
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessLLCInboxCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("llc_inbox_items")
      .insert({
        user_id: user.id,
        title: result.data.title,
        received_on: result.data.received_on,
        status: result.data.status,
        notes: result.data.notes ?? null,
        attachment_path: result.data.attachment_path ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST /api/business/llc/inbox", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_llc", resourceId: data.id, status: "success",
        changes: { title: data.title, received_on: data.received_on } },
      request
    );

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/llc/inbox", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
