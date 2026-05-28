import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessDecisionTaskCreateSchema, businessDecisionTaskPatchSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Verify the parent decision belongs to the user (helper to keep handlers small)
async function ensureDecisionOwnership(supabase: Awaited<ReturnType<typeof createClient>>, decisionId: string, userId: string) {
  const { data } = await supabase
    .from("business_decisions")
    .select("id")
    .eq("id", decisionId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

// GET /api/business/decisions/[id]/tasks — list active tasks for the decision
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!(await ensureDecisionOwnership(supabase, id, user.id))) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

    const { data, error } = await supabase
      .from("business_decision_tasks")
      .select("*")
      .eq("decision_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true });

    if (error) {
      logError("BusinessAPI", { component: "GET tasks", message: error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json({ tasks: data ?? [] }, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch (err) {
    logError("BusinessAPI", { component: "GET tasks", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/decisions/[id]/tasks — append a task
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!(await ensureDecisionOwnership(supabase, id, user.id))) return NextResponse.json({ error: "Decision not found" }, { status: 404 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessDecisionTaskCreateSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data, error } = await supabase
      .from("business_decision_tasks")
      .insert({
        user_id: user.id,
        decision_id: id,
        title: result.data.title,
        done: result.data.done,
      })
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "POST tasks", message: error?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_decision", resourceId: data.id, status: "success",
        changes: { task_title: data.title, decision_id: id } },
      request
    );

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST tasks", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/business/decisions/[id]/tasks?taskId=UUID — toggle done / edit title
// DELETE /api/business/decisions/[id]/tasks?taskId=UUID — soft-delete a single task
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId query param required" }, { status: 400 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(businessDecisionTaskPatchSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (result.data.title !== undefined) patch.title = result.data.title;
    if (result.data.done !== undefined) patch.done = result.data.done;

    const { data, error } = await supabase
      .from("business_decision_tasks")
      .update(patch)
      .eq("id", taskId)
      .eq("decision_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error || !data) {
      logError("BusinessAPI", { component: "PATCH tasks", message: error?.message ?? "not found" });
      return NextResponse.json({ error: "Update failed" }, { status: error?.code === "PGRST116" ? 404 : 500 });
    }

    await logAuditFromRequest(
      { userId: user.id, action: "update", resourceType: "business_decision", resourceId: taskId, status: "success", changes: patch },
      request
    );

    return NextResponse.json({ task: data });
  } catch (err) {
    logError("BusinessAPI", { component: "PATCH tasks", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const taskId = new URL(request.url).searchParams.get("taskId");
    if (!taskId) return NextResponse.json({ error: "taskId query param required" }, { status: 400 });

    const nowIso = new Date().toISOString();
    const { error, count } = await supabase
      .from("business_decision_tasks")
      .update({ deleted_at: nowIso, updated_at: nowIso }, { count: "exact" })
      .eq("id", taskId)
      .eq("decision_id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      logError("BusinessAPI", { component: "DELETE tasks", message: error.message });
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    if (!count) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    await logAuditFromRequest(
      { userId: user.id, action: "delete", resourceType: "business_decision", resourceId: taskId, status: "success" },
      request
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("BusinessAPI", { component: "DELETE tasks", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
