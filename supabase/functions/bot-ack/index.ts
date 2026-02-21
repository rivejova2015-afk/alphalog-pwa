// Supabase Edge Function: bot-ack
// POST /functions/v1/bot-ack

// @ts-ignore: Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global provided in Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface AckPayload {
  instance_id: string;
  instance_secret: string;
  command_id: string;
  status: "APPLIED" | "FAILED";
  message?: string;
}

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
    const payload = (await req.json()) as AckPayload;

    if (!payload?.instance_id || !payload?.instance_secret || !payload?.command_id || !payload?.status) {
      return new Response(JSON.stringify({ error: "Missing instance_id, instance_secret, command_id, or status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const auth = await authorizeInstance(supabase, payload.instance_id, payload.instance_secret);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("bot_command_status")
      .update({
        status: payload.status,
        acked_at: nowIso,
        message: payload.message || null,
      })
      .eq("command_id", payload.command_id)
      .eq("bot_account_id", auth.instance.bot_account_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: statuses } = await supabase
      .from("bot_command_status")
      .select("status")
      .eq("command_id", payload.command_id);

    const statusRows = (statuses || []) as Array<{ status: string }>;
    const allApplied = statusRows.length ? statusRows.every((s) => s.status === "APPLIED") : false;
    const anyFailed = statusRows.some((s) => s.status === "FAILED");

    if (allApplied) {
      await supabase
        .from("bot_commands")
        .update({ status: "APPLIED" })
        .eq("id", payload.command_id);
    } else if (anyFailed) {
      await supabase
        .from("bot_commands")
        .update({ status: "FAILED" })
        .eq("id", payload.command_id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bot-ack] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
