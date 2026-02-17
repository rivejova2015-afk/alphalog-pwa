/**
 * Supabase Edge Function: receive-mt5-data
 * POST /functions/v1/receive-mt5-data
 *
 * Recibe datos de MT5 (precios en vivo) y guarda en live_market_data.
 */

// @ts-ignore: Deno URL imports are resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Deno global provided in Edge Functions runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

interface MT5Data {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp?: number | string;
  token_ok?: boolean;
  source?: string;
  [key: string]: unknown;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

function toIsoTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(millis);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const parsedFromNumeric = new Date(millis);
      if (!Number.isNaN(parsedFromNumeric.getTime())) {
        return parsedFromNumeric.toISOString();
      }
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json() as MT5Data;
    const symbol = String(body.symbol || "").trim().toUpperCase();
    const bid = Number(body.bid);
    const ask = Number(body.ask);
    const last = Number(body.last);

    if (
      !symbol ||
      !Number.isFinite(bid) ||
      !Number.isFinite(ask) ||
      !Number.isFinite(last)
    ) {
      return jsonResponse(
        {
          error: "Invalid request. Required: symbol (string), bid (number), ask (number), last (number)",
        },
        400
      );
    }

    const receivedAt = toIsoTimestamp(body.timestamp);
    const source = typeof body.source === "string" && body.source.trim().length > 0
      ? body.source.trim()
      : "mt5";
    const tokenOk = typeof body.token_ok === "boolean" ? body.token_ok : false;

    const supabase = getSupabaseClient();
    const payloadForStorage = {
      ...body,
      symbol,
      bid,
      ask,
      last,
      token_ok: tokenOk,
      source,
      received_at: receivedAt,
    };

    const { data, error } = await supabase
      .from("live_market_data")
      .upsert(
        {
          symbol,
          bid,
          ask,
          last,
          token_ok: tokenOk,
          source,
          raw_payload: payloadForStorage,
          received_at: receivedAt,
        },
        { onConflict: "symbol" }
      )
      .select("id, symbol, bid, ask, last, token_ok, source, received_at, updated_at")
      .single();

    if (error) {
      console.error("[receive-mt5-data] DB upsert error:", error);
      return jsonResponse(
        {
          error: "Failed to persist MT5 data",
          details: error.message,
        },
        500
      );
    }

    console.log(`[receive-mt5-data] Upserted ${symbol} bid=${bid} ask=${ask}`);

    return jsonResponse({
      ok: true,
      message: `MT5 data for ${symbol} received successfully`,
      data,
    });
  } catch (error) {
    console.error("[receive-mt5-data] Error:", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});
