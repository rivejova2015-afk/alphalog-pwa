// Supabase Edge Function: bot-telemetry
// POST /functions/v1/bot-telemetry
// Auth via instance_id + instance_secret in body

// @ts-ignore: Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global provided in Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface TelemetryPayload {
  instance_id: string;
  instance_secret: string;
  account_id?: string;
  telemetry: {
    equity?: number;
    balance?: number;
    positions_total?: number;
    positions_buy?: number;
    positions_sell?: number;
    basket_r?: number;
    tier?: string;
    last_signal_text?: string;
    last_signal_ts?: string;
    last_heartbeat_ts?: string;
    [key: string]: unknown;
  };
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
    const payload = (await req.json()) as TelemetryPayload;

    if (!payload?.instance_id || !payload?.instance_secret || !payload?.telemetry) {
      return new Response(JSON.stringify({ error: "Missing instance_id, instance_secret, or telemetry" }), {
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
    const telemetry = payload.telemetry || {};

    const { error: upsertError } = await supabase
      .from("bot_telemetry")
      .upsert(
        {
          bot_account_id: auth.instance.bot_account_id,
          instance_id: payload.instance_id,
          equity: telemetry.equity ?? null,
          balance: telemetry.balance ?? null,
          positions_total: telemetry.positions_total ?? null,
          positions_buy: telemetry.positions_buy ?? null,
          positions_sell: telemetry.positions_sell ?? null,
          basket_r: telemetry.basket_r ?? null,
          tier: telemetry.tier ?? null,
          last_signal_text: telemetry.last_signal_text ?? null,
          last_signal_ts: telemetry.last_signal_ts ?? null,
          last_heartbeat_ts: telemetry.last_heartbeat_ts ?? nowIso,
          payload: telemetry,
          updated_at: nowIso,
        },
        { onConflict: "bot_account_id" }
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error: instanceUpdateError } = await supabase
      .from("bot_instances")
      .update({ last_heartbeat_at: nowIso, status: "ACTIVE" })
      .eq("id", auth.instance.id);

    if (instanceUpdateError) {
      console.error("[bot-telemetry] Failed to update bot_instances status:", instanceUpdateError.message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bot-telemetry] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
