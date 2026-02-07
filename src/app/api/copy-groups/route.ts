import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createInitialVersion, reportCopyGroupError } from "@/lib/copygroups/server";

export async function GET() {
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
      console.error("Error fetching copy groups:", error);
      return NextResponse.json({ error: "Failed to fetch copy groups" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "GET" });
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

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
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
      console.error("Error creating copy group:", error);
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
