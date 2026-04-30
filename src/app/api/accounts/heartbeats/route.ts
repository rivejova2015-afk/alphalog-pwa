import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/accounts/heartbeats
// Returns { [app_account_id]: { last_heartbeat_at, status, paired } } for the current user.
// Used by AccountsPanel to show the Live/Synced/Stale/Not paired badge.
export async function GET() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bot_accounts")
    .select("app_account_id, bot_instances(last_heartbeat_at, status, pairing_token_used_at)")
    .eq("user_id", userData.user.id)
    .not("app_account_id", "is", null);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch heartbeats" }, { status: 500 });
  }

  const map: Record<string, { last_heartbeat_at: string | null; status: string | null; paired: boolean }> = {};
  for (const row of data ?? []) {
    if (!row.app_account_id) continue;
    const instances = Array.isArray(row.bot_instances) ? row.bot_instances : (row.bot_instances ? [row.bot_instances] : []);
    let latest = instances[0] ?? null;
    for (const inst of instances) {
      if (!latest?.last_heartbeat_at && inst.last_heartbeat_at) latest = inst;
      if (inst.last_heartbeat_at && latest?.last_heartbeat_at && new Date(inst.last_heartbeat_at) > new Date(latest.last_heartbeat_at)) {
        latest = inst;
      }
    }
    map[row.app_account_id] = {
      last_heartbeat_at: latest?.last_heartbeat_at ?? null,
      status: latest?.status ?? null,
      paired: Boolean(latest?.pairing_token_used_at),
    };
  }

  return NextResponse.json(map, {
    headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=60" },
  });
}
