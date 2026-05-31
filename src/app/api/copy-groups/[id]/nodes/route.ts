import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

const createNodeSchema = z.object({
  account_id: z.string().uuid(),
  role: z.string().min(1).max(60),
  status: z.string().max(60).optional(),
  risk_pct: z.number().min(0).max(100).optional(),
});

const patchNodeSchema = z.object({
  node_id: z.string().uuid(),
  risk_pct: z.number().min(0).max(100).optional(),
  status: z.string().max(60).optional(),
  role: z.string().min(1).max(60).optional(),
});

const deleteNodeSchema = z.object({
  node_id: z.string().uuid(),
});

function zodErrorMessage(err: unknown): string {
  return err instanceof z.ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid request body';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let account_id: string, role: string, status: string | undefined, risk_pct: number | undefined;
    try {
      const raw = await request.json();
      ({ account_id, role, status, risk_pct } = createNodeSchema.parse(raw));
    } catch (err) {
      return NextResponse.json({ error: zodErrorMessage(err) }, { status: 400 });
    }

    const { data: node, error } = await supabase
      .from("copy_group_nodes")
      .insert({
        copy_group_id: id,
        account_id,
        role,
        status: status || "active",
        risk_pct: risk_pct ?? 0,
      })
      .select()
      .single();

    if (error || !node) {
      logError("CopyGroupsNodes", { component: "copy-groups.[id].nodes", message: "Error creating node:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Node added",
      eventPayload: { action: "node_added", node_id: node.id, account_id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "node_added",
      node_id: node.id,
      account_id,
    });

    return NextResponse.json(node);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "nodes_post" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let node_id: string, risk_pct: number | undefined, status: string | undefined, role: string | undefined;
    try {
      const raw = await request.json();
      ({ node_id, risk_pct, status, role } = patchNodeSchema.parse(raw));
    } catch (err) {
      return NextResponse.json({ error: zodErrorMessage(err) }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (risk_pct !== undefined) updates.risk_pct = risk_pct;
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role;

    const { data: node, error } = await supabase
      .from("copy_group_nodes")
      .update(updates)
      .eq("id", node_id)
      .eq("copy_group_id", id)
      .select()
      .single();

    if (error || !node) {
      logError("CopyGroupsNodes", { component: "copy-groups.[id].nodes", message: "Error updating node:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Node updated",
      eventPayload: { action: "node_updated", node_id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "node_updated",
      node_id,
    });

    return NextResponse.json(node);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "nodes_patch" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let node_id: string;
    try {
      const raw = await request.json();
      ({ node_id } = deleteNodeSchema.parse(raw));
    } catch (err) {
      return NextResponse.json({ error: zodErrorMessage(err) }, { status: 400 });
    }

    const { error } = await supabase
      .from("copy_group_nodes")
      .delete()
      .eq("id", node_id)
      .eq("copy_group_id", id);

    if (error) {
      logError("CopyGroupsNodes", { component: "copy-groups.[id].nodes", message: "Error deleting node:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Node removed",
      eventPayload: { action: "node_removed", node_id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "node_removed",
      node_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "nodes_delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
