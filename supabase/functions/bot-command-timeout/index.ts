// Supabase Edge Function (Cron): bot-command-timeout
// POST /functions/v1/bot-command-timeout

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

async function notifyPush(userId: string, title: string, body: string, data?: Record<string, string>) {
  const url = Deno.env.get("ALPHALOG_PUSH_NOTIFY_URL");
  if (!url) return;

  const token = Deno.env.get("ALPHALOG_PUSH_NOTIFY_TOKEN") || "edge";

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        title,
        body,
        tag: "alphalog-bot-timeout",
        data: data || {},
      }),
    });
  } catch (error) {
    console.error("[bot-command-timeout] Push notify failed:", error);
  }
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
    const cutoff = new Date(Date.now() - 60_000).toISOString();

    const { data: pending, error } = await supabase
      .from("bot_command_status")
      .select("id, command_id, bot_account_id, bot_accounts(user_id, bot_id)")
      .eq("status", "PENDING")
      .lt("created_at", cutoff);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const pendingRows = (pending || []) as Array<{
      id: string;
      command_id: string;
      bot_account_id: string;
      bot_accounts?: { user_id?: string; bot_id?: string };
    }>;

    if (pendingRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, timedOut: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const commandIds = Array.from(new Set(pendingRows.map((p) => p.command_id)));
    const statusIds = pendingRows.map((p) => p.id);

    await supabase
      .from("bot_command_status")
      .update({ status: "FAILED", acked_at: new Date().toISOString(), message: "Timeout" })
      .in("id", statusIds);

    await supabase
      .from("bot_commands")
      .update({ status: "FAILED" })
      .in("id", commandIds);

    const eventRows = pendingRows.map((p) => ({
      bot_id: p.bot_accounts?.bot_id,
      bot_account_id: p.bot_account_id,
      event_type: "COMMAND_TIMEOUT",
      payload: { command_id: p.command_id },
    }));

    await supabase
      .from("bot_events")
      .insert(eventRows.filter((row: { bot_id?: string | null }) => row.bot_id));

    for (const p of pendingRows) {
      if (p.bot_accounts?.user_id) {
        await notifyPush(
          p.bot_accounts.user_id,
          "⏱️ Bot command timeout",
          "Un comando no recibió ACK en 60s y fue marcado como FAILED.",
          { command_id: p.command_id }
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, timedOut: pendingRows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bot-command-timeout] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
