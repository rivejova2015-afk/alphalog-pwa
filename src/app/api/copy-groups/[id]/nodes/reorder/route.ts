import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordCopyGroupEvent } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bulk reorder helper for drag/drop. Accepts an ordered list of node IDs and
// rewrites their sort_index in one go. RLS on copy_group_nodes enforces that
// the user only touches nodes they own (via copy_group_id → copy_groups.owner_id).
const bodySchema = z.object({
  // ordered_ids[i] gets sort_index = i. All ids must belong to the same group.
  ordered_ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: copyGroupId } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    // Verify all IDs really belong to this group (defense in depth; RLS does it too).
    const { data: existingNodes, error: fetchErr } = await supabase
      .from("copy_group_nodes")
      .select("id")
      .eq("copy_group_id", copyGroupId)
      .in("id", parsed.data.ordered_ids);

    if (fetchErr) {
      logError("CopyGroups", { component: "PATCH nodes/reorder", message: fetchErr.message });
      return NextResponse.json({ error: "Failed to fetch nodes" }, { status: 500 });
    }

    if (!existingNodes || existingNodes.length !== parsed.data.ordered_ids.length) {
      return NextResponse.json({ error: "Some node IDs do not belong to this group" }, { status: 400 });
    }

    // Update each node's sort_index. We do it sequentially because Supabase has
    // no bulk-update-with-different-values primitive — but with N ≤ 200 and a
    // single user this is fine (~50ms total round-trip locally).
    const updates = parsed.data.ordered_ids.map((nodeId, index) =>
      supabase
        .from("copy_group_nodes")
        .update({ sort_index: index })
        .eq("id", nodeId)
        .eq("copy_group_id", copyGroupId),
    );

    const results = await Promise.all(updates);
    const updateErr = results.find((r) => r.error)?.error;
    if (updateErr) {
      logError("CopyGroups", { component: "PATCH nodes/reorder", message: updateErr.message });
      return NextResponse.json({ error: "Failed to reorder nodes" }, { status: 500 });
    }

    // Audit trail in copy_group_events so versioning/timeline captures the change.
    await recordCopyGroupEvent(
      supabase,
      copyGroupId,
      "nodes_reordered",
      user.id,
      { ordered_ids: parsed.data.ordered_ids },
    );

    return NextResponse.json({ ok: true, count: parsed.data.ordered_ids.length });
  } catch (err) {
    logError("CopyGroups", { component: "PATCH nodes/reorder", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
