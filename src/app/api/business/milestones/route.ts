import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessMilestoneCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/milestones — list active milestones (open vs done)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("business_milestones")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("target_date", { ascending: true, nullsFirst: false });

    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/milestones", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { milestones: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/milestones", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/milestones — create a milestone
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessMilestoneCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("business_milestones")
      .insert({
        user_id: user.id,
        title: result.data.title,
        description: result.data.description ?? "",
        target_date: result.data.target_date ?? null,
        status: result.data.status,
        goal_id: result.data.goal_id ?? null,
        notes: result.data.notes ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST /api/business/milestones", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_milestone", resourceId: data.id, status: "success",
        changes: { title: data.title, status: data.status } },
      request
    );

    return NextResponse.json({ milestone: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/milestones", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
