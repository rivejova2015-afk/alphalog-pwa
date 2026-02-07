import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { account_id, role, status, risk_pct } = body || {};

    if (!account_id || !role) {
      return NextResponse.json({ error: "account_id and role are required" }, { status: 400 });
    }

    const { data: node, error } = await supabase
      .from("copy_group_nodes")
      .insert({
        copy_group_id: params.id,
        account_id,
        role,
        status: status || "active",
        risk_pct: risk_pct ?? 0,
      })
      .select()
      .single();

    if (error || !node) {
      console.error("Error creating node:", error);
      return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: params.id,
      actorId: userData.user.id,
      message: "Node added",
      eventPayload: { action: "node_added", node_id: node.id, account_id },
    });

    await recordCopyGroupEvent(supabase, params.id, "CONFIG_CHANGED", userData.user.id, {
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { node_id, risk_pct, status, role } = body || {};

    if (!node_id) {
      return NextResponse.json({ error: "node_id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (risk_pct !== undefined) updates.risk_pct = risk_pct;
    if (status !== undefined) updates.status = status;
    if (role !== undefined) updates.role = role;

    const { data: node, error } = await supabase
      .from("copy_group_nodes")
      .update(updates)
      .eq("id", node_id)
      .eq("copy_group_id", params.id)
      .select()
      .single();

    if (error || !node) {
      console.error("Error updating node:", error);
      return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: params.id,
      actorId: userData.user.id,
      message: "Node updated",
      eventPayload: { action: "node_updated", node_id },
    });

    await recordCopyGroupEvent(supabase, params.id, "CONFIG_CHANGED", userData.user.id, {
      action: "node_updated",
      node_id,
    });

    return NextResponse.json(node);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "nodes_patch" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { node_id } = body || {};

    if (!node_id) {
      return NextResponse.json({ error: "node_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("copy_group_nodes")
      .delete()
      .eq("id", node_id)
      .eq("copy_group_id", params.id);

    if (error) {
      console.error("Error deleting node:", error);
      return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: params.id,
      actorId: userData.user.id,
      message: "Node removed",
      eventPayload: { action: "node_removed", node_id },
    });

    await recordCopyGroupEvent(supabase, params.id, "CONFIG_CHANGED", userData.user.id, {
      action: "node_removed",
      node_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "nodes_delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
