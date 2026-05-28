import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessDecisionCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/decisions — list active decisions ordered by sort_index desc
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("business_decisions")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/decisions", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { decisions: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/decisions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/decisions — create a strategic decision (no tasks yet; add via tasks route)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessDecisionCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("business_decisions")
      .insert({
        user_id: user.id,
        title: result.data.title,
        context: result.data.context,
        decision: result.data.decision,
        rationale: result.data.rationale,
        impact: result.data.impact,
        tags: result.data.tags,
        priority: result.data.priority,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST /api/business/decisions", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_decision", resourceId: data.id, status: "success",
        changes: { title: data.title, priority: data.priority } },
      request
    );

    return NextResponse.json({ decision: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/decisions", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
