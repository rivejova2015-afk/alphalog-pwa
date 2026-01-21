/**
 * POST /api/webhooks/mt5
 * Webhook receiver para datos de MT5
 * Valida request y redirige a Supabase Edge Function
 */

import { NextResponse, type NextRequest } from 'next/server';

interface MT5Payload {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MT5Payload;

    // Validate
    if (!body.symbol || typeof body.bid !== 'number' || typeof body.ask !== 'number' || typeof body.last !== 'number') {
      return NextResponse.json(
        {
          error: 'Invalid request. Required: symbol, bid, ask, last',
        },
        { status: 400 },
      );
    }

    console.log(`[MT5 Webhook] Received: ${body.symbol} bid=${body.bid} ask=${body.ask}`);

    // Call Supabase Edge Function
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receive-mt5-data`;

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[MT5 Webhook] Edge function error:', data);
        return NextResponse.json(data, { status: response.status });
      }

      return NextResponse.json(
        {
          ok: true,
          message: 'Data forwarded to Edge Function',
          result: data,
        },
        { status: 200 },
      );
    } catch (edgeError) {
      console.error('[MT5 Webhook] Failed to call edge function:', edgeError);
      return NextResponse.json(
        {
          error: 'Failed to forward to edge function',
          details: edgeError instanceof Error ? edgeError.message : 'Unknown error',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error('[MT5 Webhook] Request parsing error:', error);
    return NextResponse.json(
      {
        error: 'Invalid request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 },
    );
  }
}

/**
 * GET /api/webhooks/mt5
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'MT5 webhook endpoint ready',
    usage: 'POST JSON: { symbol, bid, ask, last }',
  });
}
