import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { logAuditFromRequest } from "@/lib/security/auditLog";
import { businessSOPCreateSchema, businessSOPItemCreateSchema, validatePayloadSafe, validationErrorResponse } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sopWithItemsSchema = businessSOPCreateSchema.extend({
  items: z.array(businessSOPItemCreateSchema).max(50).optional().default([]),
});

// GET /api/business/sops — list active SOPs with their items joined
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [sopsRes, itemsRes] = await Promise.all([
      supabase
        .from("business_sops")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true }),
      supabase
        .from("business_sop_items")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true }),
    ]);

    if (sopsRes.error) {
      logError("BusinessAPI", { component: "GET /api/business/sops", message: sopsRes.error.message });
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    const itemsBySop = new Map<string, unknown[]>();
    for (const item of itemsRes.data ?? []) {
      const sopId = (item as { sop_id: string }).sop_id;
      if (!itemsBySop.has(sopId)) itemsBySop.set(sopId, []);
      itemsBySop.get(sopId)!.push(item);
    }

    const sops = (sopsRes.data ?? []).map((s) => ({
      ...s,
      items: itemsBySop.get((s as { id: string }).id) ?? [],
    }));

    return NextResponse.json(
      { sops },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    logError("BusinessAPI", { component: "GET /api/business/sops", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/business/sops — create SOP + items inline (single-shot)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const result = validatePayloadSafe(sopWithItemsSchema, body);
    if (!result.success) return NextResponse.json(validationErrorResponse(result.errors), { status: 400 });

    const { data: sop, error: sopErr } = await supabase
      .from("business_sops")
      .insert({
        user_id: user.id,
        title: result.data.title,
        type: result.data.type,
        content: result.data.content ?? "",
      })
      .select()
      .single();

    if (sopErr || !sop) {
      logError("BusinessAPI", { component: "POST /api/business/sops", message: sopErr?.message ?? "no data" });
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    let items: unknown[] = [];
    if (result.data.items.length > 0) {
      const rows = result.data.items.map((it, idx) => ({
        user_id: user.id,
        sop_id: sop.id,
        label: it.label,
        sort_index: idx,
      }));
      const { data: itemsData, error: itemsErr } = await supabase
        .from("business_sop_items")
        .insert(rows)
        .select();
      if (itemsErr) {
        logError("BusinessAPI", { component: "POST /api/business/sops (items)", message: itemsErr.message });
        // SOP created but items failed — return SOP without items, client can retry
      } else {
        items = itemsData ?? [];
      }
    }

    await logAuditFromRequest(
      { userId: user.id, action: "create", resourceType: "business_sop", resourceId: sop.id, status: "success",
        changes: { title: sop.title, type: sop.type, item_count: items.length } },
      request
    );

    return NextResponse.json({ sop: { ...sop, items } }, { status: 201 });
  } catch (err) {
    logError("BusinessAPI", { component: "POST /api/business/sops", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
