// Supabase Edge Function: bot-maintenance
// POST /functions/v1/bot-maintenance

// @ts-ignore: Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global provided in Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function shouldEnforceOfflineStatus() {
  const raw = Deno.env.get("BOT_MAINTENANCE_ENFORCE_OFFLINE_STATUS");
  if (!raw) return false;
  return raw.toLowerCase() === "true";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = getSupabaseClient();
    const now = new Date();
    const offlineCutoff = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
    const commandsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const eventsCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const enforceOfflineStatus = shouldEnforceOfflineStatus();

    const { count: staleCandidates, error: staleCountError } = await supabase
      .from("bot_instances")
      .select("id", { count: "exact", head: true })
      .lt("last_heartbeat_at", offlineCutoff)
      .neq("status", "OFFLINE");

    if (staleCountError) {
      console.error("[bot-maintenance] stale count error:", staleCountError);
    }

    let offlineError = null;
    if (enforceOfflineStatus) {
      const offlineMutation = await supabase
        .from("bot_instances")
        .update({ status: "OFFLINE" })
        .lt("last_heartbeat_at", offlineCutoff)
        .neq("status", "OFFLINE");
      offlineError = offlineMutation.error;
    }

    if (offlineError) {
      console.error("[bot-maintenance] offline update error:", offlineError);
    }

    const { error: commandsError } = await supabase
      .from("bot_commands")
      .delete()
      .lt("created_at", commandsCutoff);

    if (commandsError) {
      console.error("[bot-maintenance] commands cleanup error:", commandsError);
    }

    const { error: statusError } = await supabase
      .from("bot_command_status")
      .delete()
      .lt("created_at", commandsCutoff);

    if (statusError) {
      console.error("[bot-maintenance] status cleanup error:", statusError);
    }

    const { error: eventsError } = await supabase
      .from("bot_events")
      .delete()
      .lt("created_at", eventsCutoff);

    if (eventsError) {
      console.error("[bot-maintenance] events cleanup error:", eventsError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        offlineCutoff,
        commandsCutoff,
        eventsCutoff,
        staleCandidates: staleCandidates ?? 0,
        offlineMutationApplied: enforceOfflineStatus,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bot-maintenance] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
