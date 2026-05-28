import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { businessCostCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/costs?month=YYYY-MM — list active costs (optional month filter)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const month = url.searchParams.get("month");

    let query = supabase
      .from("business_costs")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("cost_date", { ascending: false });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query = query.gte("cost_date", `${month}-01`).lte("cost_date", `${month}-31`);
    }

    const { data, error } = await query;
    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/costs", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { costs: data ?? [] },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/costs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/costs — create a one-off cost
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessCostCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("business_costs")
      .insert({
        user_id: user.id,
        amount: result.data.amount,
        category: result.data.category,
        description: result.data.description,
        vendor: result.data.vendor,
        cost_date: result.data.cost_date,
        is_recurring_instance: result.data.is_recurring_instance ?? false,
        template_id: result.data.template_id ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      const message = error?.message ?? "no data returned";
      logError("BusinessAPI", { component: "POST /api/business/costs", message });
      await recordBugFromRequest(request, { userId: user.id, status: 500, error: message, payload: { route: "POST /api/business/costs" } });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_cost", resourceId: data.id, status: "success",
        changes: { amount: data.amount, category: data.category, vendor: data.vendor, cost_date: data.cost_date } },
      request
    );

    return NextResponse.json({ cost: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/costs", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
