// Supabase Edge Function: bot-settings-effective
// GET /functions/v1/bot-settings-effective?account_id=...

// @ts-ignore: Supabase Edge Functions provide 'serve' globally
import { serve } from 'std/server';
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

serve(async (req: Request) => {
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

    const botId = auth.instance.bot_accounts.bot_id;

    const { data: globalSettings } = await supabase
      .from("bot_settings_global")
      .select("settings")
      .eq("bot_id", botId)
      .maybeSingle();

    const { data: overrideSettings } = await supabase
      .from("bot_settings_override")
      .select("settings")
      .eq("bot_account_id", auth.instance.bot_account_id)
      .maybeSingle();

    const effective = {
      ...(globalSettings?.settings || {}),
      ...(overrideSettings?.settings || {}),
    };

    return new Response(JSON.stringify({ settings: effective }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bot-settings-effective] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
