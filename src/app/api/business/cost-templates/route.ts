import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessCostTemplateCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/cost-templates — list active templates (used by the recurring-costs cron)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("business_cost_templates")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("day_of_month", { ascending: true });

    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/cost-templates", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { templates: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/cost-templates", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/cost-templates — create a recurring template that the cron picks up monthly
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessCostTemplateCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("business_cost_templates")
      .insert({
        user_id: user.id,
        amount: result.data.amount,
        category: result.data.category,
        description: result.data.description,
        vendor: result.data.vendor,
        day_of_month: result.data.day_of_month,
        start_month: result.data.start_month,
        active: result.data.active,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST /api/business/cost-templates", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_cost_template", resourceId: data.id, status: "success",
        changes: { vendor: data.vendor, amount: data.amount, day_of_month: data.day_of_month } },
      request
    );

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/cost-templates", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
