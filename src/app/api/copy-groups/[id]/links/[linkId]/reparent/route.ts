import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reparent a node: move the link's parent_account_id to a new parent. This is
// the topology-changing operation behind drag&drop reparent in the AAB tree.
// The unique index (copy_group_id, child_account_id) WHERE solid guarantees a
// child has a single solid parent, so reparent is an in-place UPDATE of the
// existing link rather than delete+create.
const bodySchema = z.object({
  new_parent_account_id: z.string().uuid(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, linkId } = await params;

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const newParent = parsed.data.new_parent_account_id;

    // Load the link being moved (RLS scopes it to the owner).
    const { data: link, error: linkErr } = await supabase
      .from("copy_group_links")
      .select("id, copy_group_id, parent_account_id, child_account_id, link_type")
      .eq("id", linkId)
      .eq("copy_group_id", id)
      .single();

    if (linkErr || !link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (newParent === link.child_account_id) {
      return NextResponse.json({ error: "Un nodo no puede ser su propio padre" }, { status: 400 });
    }
    if (newParent === link.parent_account_id) {
      return NextResponse.json({ error: "El nodo ya cuelga de ese padre" }, { status: 400 });
    }

    // The new parent must be a node in this group.
    const { data: parentNode } = await supabase
      .from("copy_group_nodes")
      .select("id")
      .eq("copy_group_id", id)
      .eq("account_id", newParent)
      .maybeSingle();

    if (!parentNode) {
      return NextResponse.json({ error: "El nuevo padre no pertenece a este grupo" }, { status: 400 });
    }

    // Cycle pre-check for a clean 409 (the DB trigger also enforces this).
    const { data: wouldCycle, error: cycleErr } = await supabase.rpc("copy_group_would_create_cycle", {
      p_copy_group_id: id,
      p_parent_account_id: newParent,
      p_child_account_id: link.child_account_id,
    });

    if (cycleErr) {
      logError("CopyGroupsLinks", { component: "links.reparent", message: cycleErr.message });
      return NextResponse.json({ error: "Failed to validate move" }, { status: 500 });
    }
    if (wouldCycle) {
      return NextResponse.json({ error: "El movimiento crearía un ciclo" }, { status: 409 });
    }

    const { data: updated, error: updErr } = await supabase
      .from("copy_group_links")
      .update({ parent_account_id: newParent })
      .eq("id", linkId)
      .eq("copy_group_id", id)
      .select()
      .single();

    if (updErr || !updated) {
      // Trigger raises 'Cycle detected in copy_group_links' if a race slipped in.
      const msg = updErr?.message ?? "";
      const isCycle = msg.includes("Cycle");
      logError("CopyGroupsLinks", { component: "links.reparent", message: msg || "update failed" });
      return NextResponse.json(
        { error: isCycle ? "El movimiento crearía un ciclo" : "Failed to reparent link" },
        { status: isCycle ? 409 : 500 },
      );
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Link reparented",
      eventPayload: { action: "link_reparented", link_id: linkId, new_parent_account_id: newParent },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "link_reparented",
      link_id: linkId,
      old_parent_account_id: link.parent_account_id,
      new_parent_account_id: newParent,
    });

    return NextResponse.json(updated);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "links_reparent" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
