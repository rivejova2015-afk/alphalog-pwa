import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const flags = body?.flags && typeof body.flags === "object" ? body.flags : {};

    const { error } = await supabase
      .from("copy_group_experiments")
      .upsert({
        copy_group_id: params.id,
        flags_json: flags,
      }, { onConflict: "copy_group_id" });

    if (error) {
      console.error("Error updating experiments:", error);
      return NextResponse.json({ error: "Failed to update experiments" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: params.id,
      actorId: userData.user.id,
      message: "Experiments updated",
      eventPayload: { action: "experiments_updated" },
    });

    await recordCopyGroupEvent(supabase, params.id, "CONFIG_CHANGED", userData.user.id, {
      action: "experiments_updated",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "experiments_patch" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
