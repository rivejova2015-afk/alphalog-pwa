// Supabase Edge Function: bot-commands
// GET /functions/v1/bot-commands?account_id=...

// @ts-ignore: Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global provided in Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
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

async function authorizeInstance(supabase: ReturnType<typeof getSupabaseClient>, instanceId: string, instanceSecret: string) {
  const { data, error } = await supabase
    .from("bot_instances")
    .select("id, instance_id, instance_secret, bot_account_id, bot_accounts(id, user_id, bot_id)")
    .eq("instance_id", instanceId)
    .single();

  if (error || !data) {
    return { ok: false, error: "Instance not found" };
  }

  if (data.instance_secret !== instanceSecret) {
    return { ok: false, error: "Invalid instance secret" };
  }

  return {
    ok: true,
    instance: data,
  } as const;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-instance-id, x-instance-secret",
      },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const instanceId = req.headers.get("x-instance-id") || "";
    const instanceSecret = req.headers.get("x-instance-secret") || "";

    if (!instanceId || !instanceSecret) {
      return new Response(JSON.stringify({ error: "Missing x-instance-id or x-instance-secret" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const auth = await authorizeInstance(supabase, instanceId, instanceSecret);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: pending, error } = await supabase
      .from("bot_command_status")
      .select("id, status, command:bot_commands(id, command_type, payload, created_at)")
      .eq("bot_account_id", auth.instance.bot_account_id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ commands: pending || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bot-commands] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
