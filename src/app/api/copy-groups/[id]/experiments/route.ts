import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createSnapshotVersion, recordCopyGroupEvent, reportCopyGroupError } from "@/lib/copygroups/server";
import { logError } from "@/lib/log";

const patchSchema = z.object({
  flags: z.record(z.string(), z.unknown()).default({}),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let flags: Record<string, unknown>;
    try {
      const raw = await request.json();
      ({ flags } = patchSchema.parse(raw));
    } catch (err) {
      const message = err instanceof z.ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid request body';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { error } = await supabase
      .from("copy_group_experiments")
      .upsert({
        copy_group_id: id,
        flags_json: flags,
      }, { onConflict: "copy_group_id" });

    if (error) {
      logError("CopyGroupsExperiments", { component: "copy-groups.[id].experiments", message: "Error updating experiments:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to update experiments" }, { status: 500 });
    }

    await createSnapshotVersion({
      supabase,
      copyGroupId: id,
      actorId: userData.user.id,
      message: "Experiments updated",
      eventPayload: { action: "experiments_updated" },
    });

    await recordCopyGroupEvent(supabase, id, "CONFIG_CHANGED", userData.user.id, {
      action: "experiments_updated",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "experiments_patch" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
