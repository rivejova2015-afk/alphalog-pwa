import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessLLCInfoUpsertSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/business/llc — returns user's LLC info (or null if not configured yet)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("llc_info")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      logError("BusinessAPI", { component: "GET /api/business/llc", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json(
      { llc: data ?? null },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/llc", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/business/llc — upsert (insert if absent, replace if present)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessLLCInfoUpsertSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("llc_info")
      .upsert(
        {
          user_id: user.id,
          llc_name: result.data.llc_name,
          formation_date: result.data.formation_date ?? null,
          annual_report_due_month: result.data.annual_report_due_month,
          annual_fee_baseline: result.data.annual_fee_baseline,
          registered_agent_name: result.data.registered_agent_name,
          ein: result.data.ein,
          notes: result.data.notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PUT /api/business/llc", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_llc", resourceId: data.id, status: "success",
        changes: { llc_name: data.llc_name, ein_set: Boolean(data.ein) } },
      request
    );

    return NextResponse.json({ llc: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PUT /api/business/llc", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
