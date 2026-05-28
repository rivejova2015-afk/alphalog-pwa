import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { parent_account_id, child_account_id, copy_multiplier, link_type } = body || {};

    if (!parent_account_id || !child_account_id) {
      return NextResponse.json({ error: "parent_account_id and child_account_id are required" }, { status: 400 });
    }

    const { data: link, error } = await supabase
      .from("copy_group_links")
      .insert({
        copy_group_id: id,
        parent_account_id,
        child_account_id,
        copy_multiplier: copy_multiplier ?? 1,
        link_type: link_type || "solid",
      })
      .select()
      .single();

    if (error || !link) {
      logError("CopyGroupsLinks", { component: "copy-groups.[id].links", message: "Error creating link:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Link added",
      eventPayload: { action: "link_added", link_id: link.id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "link_added",
      link_id: link.id,
    });

    return NextResponse.json(link);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "links_post" });
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
    const body = await request.json();
    const { link_id, copy_multiplier, link_type } = body || {};

    if (!link_id) {
      return NextResponse.json({ error: "link_id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (copy_multiplier !== undefined) updates.copy_multiplier = copy_multiplier;
    if (link_type !== undefined) updates.link_type = link_type;

    const { data: link, error } = await supabase
      .from("copy_group_links")
      .update(updates)
      .eq("id", link_id)
      .eq("copy_group_id", id)
      .select()
      .single();

    if (error || !link) {
      logError("CopyGroupsLinks", { component: "copy-groups.[id].links", message: "Error updating link:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to update link" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Link updated",
      eventPayload: { action: "link_updated", link_id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "link_updated",
      link_id,
    });

    return NextResponse.json(link);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "links_patch" });
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
    const body = await request.json();
    const { link_id } = body || {};

    if (!link_id) {
      return NextResponse.json({ error: "link_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("copy_group_links")
      .delete()
      .eq("id", link_id)
      .eq("copy_group_id", id);

    if (error) {
      logError("CopyGroupsLinks", { component: "copy-groups.[id].links", message: "Error deleting link:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Link removed",
      eventPayload: { action: "link_removed", link_id },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "link_removed",
      link_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "links_delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
