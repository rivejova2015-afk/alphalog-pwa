import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const versionInt = Number(body?.version_int);

    if (!Number.isFinite(versionInt)) {
      return NextResponse.json({ error: "version_int is required" }, { status: 400 });
    }

    const { data: snapshotRow, error: snapshotError } = await supabase
      .from("copy_group_snapshots")
      .select("snapshot_json")
      .eq("copy_group_id", id)
      .eq("version_int", versionInt)
      .single();

    if (snapshotError || !snapshotRow) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const serviceClient = createServiceClient();
    const { error: applyError } = await serviceClient.rpc("copy_group_apply_snapshot", {
      p_copy_group_id: id,
      p_snapshot: snapshotRow.snapshot_json,
    });

    if (applyError) {
      console.error("Error applying snapshot:", applyError);
      return NextResponse.json({ error: "Failed to apply snapshot" }, { status: 500 });
    }

    const newVersion = await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: `Rollback from v${versionInt}`,
      eventPayload: { action: "rollback", from: versionInt },
    });

    await recordCopyGroupEvent(supabase, id, "ROLLBACK_APPLIED", userData.user.id, {
      from: versionInt,
      to: newVersion,
    });

    return NextResponse.json({ success: true, version: newVersion });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "rollback" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
