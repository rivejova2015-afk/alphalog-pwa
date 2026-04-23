import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportCopyGroupError } from "@/lib/copygroups/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { data: group } = await supabase
      .from("copy_groups")
      .select("id, name, active_version, sync_mode, created_at, updated_at")
      .eq("id", id)
      .eq("owner_id", userData.user.id)
      .single();

    if (!group) {
      return NextResponse.json({ error: "CopyGroup not found" }, { status: 404 });
    }

    const [{ data: nodes }, { data: links }, { data: versions }, { data: events }, { data: experiments }] =
      await Promise.all([
        supabase
          .from("copy_group_nodes")
          .select(
            "id, copy_group_id, account_id, role, status, risk_pct, risk_node, created_at, updated_at, account:accounts(id, name, currency, status, operation_state, phase_status, role)"
          )
          .eq("copy_group_id", id),
        supabase
          .from("copy_group_links")
          .select("id, copy_group_id, parent_account_id, child_account_id, copy_multiplier, link_type, created_at")
          .eq("copy_group_id", id),
        supabase
          .from("copy_group_versions")
          .select("id, version_int, message, created_by, created_at")
          .eq("copy_group_id", id)
          .order("version_int", { ascending: false })
          .limit(25),
        supabase
          .from("copy_group_events")
          .select("id, event_type, actor_id, payload_json, created_at")
          .eq("copy_group_id", id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("copy_group_experiments")
          .select("flags_json")
          .eq("copy_group_id", id)
          .maybeSingle(),
      ]);

    return NextResponse.json({
      group,
      nodes: nodes || [],
      links: links || [],
      versions: versions || [],
      events: events || [],
      experiments: experiments?.flags_json || {},
    });
  } catch (error) {
    reportCopyGroupError(error, { area: "copy-groups", action: "graph" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
