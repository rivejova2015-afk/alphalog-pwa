/**
 * POST /api/webhooks/mt5
 * Webhook receiver para datos de MT5
 * Valida request y redirige a Supabase Edge Function
 */

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'crypto';
import { retryAsync, isRetryableError } from '@/lib/security/retry';
import { getPgClient } from '@/lib/pg/client';
import { logError, logInfo, logWarn } from '@/lib/log';

export const runtime = 'nodejs';

interface MT5Payload {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  timestamp?: number;
}

const MAX_SKEW_MS = 5 * 60 * 1000;

function validateMt5Signature(body: string, signature: string | null, timestamp: string | null) {
  const secret = process.env.MT5_WEBHOOK_SECRET;

  if (!secret) {
    return { ok: false, status: 500, error: 'Missing MT5 webhook secret' };
  }

  if (!signature || !timestamp) {
    return { ok: false, status: 401, error: 'Missing signature headers' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, status: 401, error: 'Invalid timestamp' };
  }

  const now = Date.now();
  if (Math.abs(now - ts) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: 'Signature expired' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }

  const valid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

  return valid ? { ok: true } : { ok: false, status: 401, error: 'Invalid signature' };
}

async function validatePairingSecret(rawBody: string, secret: string | null): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!secret) return { ok: false, status: 401, error: 'Missing x-webhook-secret' };
  try {
    const payload = JSON.parse(rawBody) as { bot_instance_id?: string };
    const instanceId = payload.bot_instance_id;
    if (!instanceId) return { ok: false, status: 401, error: 'Missing bot_instance_id in payload' };

    const pg = getPgClient();
    const { data: rawData } = await pg
      .from('bot_instances')
      .select('webhook_secret_hash')
      .eq('id', instanceId)
      .single();
    const data = rawData as { webhook_secret_hash: string } | null;

    if (!data?.webhook_secret_hash) return { ok: false, status: 401, error: 'Instance not found or not paired' };

    const incomingHash = crypto.createHash('sha256').update(secret).digest('hex');
    const a = Buffer.from(incomingHash);
    const b = Buffer.from(data.webhook_secret_hash);
    if (a.length !== b.length) return { ok: false, status: 401, error: 'Invalid secret' };
    const valid = crypto.timingSafeEqual(a, b);
    return valid ? { ok: true } : { ok: false, status: 401, error: 'Invalid secret' };
  } catch {
    return { ok: false, status: 401, error: 'Auth error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Pairing-based auth: EA sends raw webhook_secret in header
    const pairingSecret = request.headers.get('x-webhook-secret');
    if (pairingSecret) {
      const result = await validatePairingSecret(rawBody, pairingSecret);
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Unauthorized' }, { status: result.status || 401 });
      }
    } else {
      // Legacy HMAC auth: env-var-based setup
      const signature = request.headers.get('x-mt5-signature');
      const timestamp = request.headers.get('x-mt5-timestamp');
      const signatureResult = validateMt5Signature(rawBody, signature, timestamp);
      if (!signatureResult.ok) {
        return NextResponse.json({ error: signatureResult.error || 'Unauthorized' }, { status: signatureResult.status || 401 });
      }
    }

    const body = JSON.parse(rawBody) as MT5Payload;

    // Validate
    if (!body.symbol || typeof body.bid !== 'number' || typeof body.ask !== 'number' || typeof body.last !== 'number') {
      return NextResponse.json(
        {
          error: 'Invalid request. Required: symbol, bid, ask, last',
        },
        { status: 400 },
      );
    }

    logInfo('WebhookMT', 'Received', { component: 'mt5.received', symbol: body.symbol, bid: body.bid, ask: body.ask });

    // Call Supabase Edge Function
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receive-mt5-data`;

    try {
      const response = await retryAsync(async () => {
        const res = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        });

        if (res.status >= 500) {
          const retryError = new Error(`Edge function failed: ${res.status}`) as Error & { status?: number };
          retryError.status = res.status;
          throw retryError;
        }

        return res;
      }, {
        retries: 2,
        minDelayMs: 300,
        maxDelayMs: 2000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delayMs) => {
          logWarn('WebhookMT', 'Retry', { component: 'mt5.retry', attempt, delayMs, error: error instanceof Error ? error.message : String(error) });
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        logError('WebhookMT', { component: 'mt5.edgeFunction', message: typeof data === 'object' && data && 'error' in data ? String((data as { error: unknown }).error) : 'edge function returned error', payload: data });
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
      logError('WebhookMT', { component: 'mt5.edgeFunctionCall', message: edgeError instanceof Error ? edgeError.message : String(edgeError) });
      return NextResponse.json(
        {
          error: 'Failed to forward to edge function',
          details: edgeError instanceof Error ? edgeError.message : 'Unknown error',
        },
        { status: 502 },
      );
    }
  } catch (error) {
    logError('WebhookMT', { component: 'mt5.requestParsing', message: error instanceof Error ? error.message : String(error) });
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
    usage: 'POST JSON: { symbol, bid, ask, last } with x-mt5-signature + x-mt5-timestamp',
  });
}
