/**
 * Supabase Edge Function: receive-mt5-data
 * POST /functions/v1/receive-mt5-data
 * 
 * Recibe datos de MT5 (precios en vivo) y guarda en live_market_data table
 */

// @ts-ignore: Supabase Edge Functions provide 'serve' globally
import { serve } from 'std/server';

interface MT5Data {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp?: number;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json() as MT5Data;

    // Validate required fields
    if (!body.symbol || typeof body.bid !== "number" || typeof body.ask !== "number" || typeof body.last !== "number") {
      return new Response(
        JSON.stringify({
          error: "Invalid request. Required: symbol (string), bid (number), ask (number), last (number)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[receive-mt5-data] Received: ${body.symbol} bid=${body.bid} ask=${body.ask}`);

    // TODO: In production, use Supabase client to insert into live_market_data table
    // For now, just validate and return success
    return new Response(
      JSON.stringify({
        ok: true,
        message: `MT5 data for ${body.symbol} received successfully`,
        data: {
          symbol: body.symbol,
          bid: body.bid,
          ask: body.ask,
          last: body.last,
          receivedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[receive-mt5-data] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
