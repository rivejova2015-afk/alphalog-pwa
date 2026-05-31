import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

const rollbackSchema = z.object({
  version_int: z.number().int().positive(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let versionInt: number;
    try {
      const raw = await request.json();
      const normalized = raw && typeof raw === 'object' && raw !== null
        ? { ...raw, version_int: Number((raw as Record<string, unknown>).version_int) }
        : raw;
      ({ version_int: versionInt } = rollbackSchema.parse(normalized));
    } catch (err) {
      const message = err instanceof z.ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid request body';
      return NextResponse.json({ error: message }, { status: 400 });
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
      logError("CopyGroupsRollback", { component: "copy-groups.[id].rollback", message: "Error applying snapshot:", error: applyError instanceof Error ? applyError.message : String(applyError) });
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
