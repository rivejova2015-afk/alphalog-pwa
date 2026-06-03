import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createInitialVersion, reportCopyGroupError } from "@/lib/copygroups/server";
import { recordBugFromRequest } from "@/lib/security/bugRecorder";
import { logError } from "@/lib/log";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("copy_groups")
      .select("id, name, active_version, sync_mode, created_at, updated_at")
      .eq("owner_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logError("CopyGroups", { component: "copy-groups", message: "Error fetching copy groups:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to fetch copy groups" }, { status: 500 });
    }

    return NextResponse.json(data || [], {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "GET" });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let name: string;
    try {
      const raw = await request.json();
      ({ name } = createGroupSchema.parse(raw));
    } catch (err) {
      const message = err instanceof z.ZodError ? err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') : 'Invalid request body';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: group, error } = await supabase
      .from("copy_groups")
      .insert({
        name,
        owner_id: userData.user.id,
      })
      .select()
      .single();

    if (error || !group) {
      logError("CopyGroups", { component: "copy-groups", message: "Error creating copy group:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: "Failed to create copy group" }, { status: 500 });
    }

    await supabase.from("copy_group_experiments").insert({
      copy_group_id: group.id,
      flags_json: {},
    });

    await createInitialVersion({
      supabase,
      copyGroupId: group.id,
      actorId: userData.user.id,
      message: "Initial version",
    });

    return NextResponse.json(group);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "POST" });
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
