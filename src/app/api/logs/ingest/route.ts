/**
 * POST /api/logs/ingest
 * Authenticated endpoint for ingesting client logs into app_logs table
 *
 * Requires:
 * - Valid session (user_id extracted from session)
 * - CORS allowed for same-origin requests
 *
 * Request body:
 * {
 *   logs: [
 *     {
 *       level: "error",
 *       area: "tradehub",
 *       message: "Failed to fetch data",
 *       meta: { ... },
 *       fingerprint: "...",
 *       url: "https://...",
 *       user_agent: "Mozilla/5.0...",
 *       timestamp: 1234567890,
 *       sent: false
 *     },
 *     ...
 *   ]
 * }
 *
 * Response:
 * {
 *   success: true,
 *   ingested: 5,
 *   failed: 0,
 *   errors: []
 * }
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { logError } from "@/lib/log";

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  area: string;
  message: string;
  meta?: Record<string, unknown>;
  fingerprint: string;
  url?: string | null;
  user_agent?: string | null;
  timestamp?: number;
  sent?: boolean;
}

/**
 * Validate log entry
 */
function validateLog(log: Partial<LogEntry>): { valid: boolean; error?: string } {
  if (!log.level || !['debug', 'info', 'warn', 'error'].includes(log.level)) {
    return { valid: false, error: 'Invalid log level' };
  }

  if (!log.area || typeof log.area !== 'string' || log.area.length === 0) {
    return { valid: false, error: 'Missing or invalid area' };
  }

  if (!log.message || typeof log.message !== 'string' || log.message.length === 0) {
    return { valid: false, error: 'Missing or invalid message' };
  }

  if (!log.fingerprint || typeof log.fingerprint !== 'string') {
    return { valid: false, error: 'Missing or invalid fingerprint' };
  }

  return { valid: true };
}

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    // Get session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.logs)) {
      return NextResponse.json(
        { error: 'logs must be an array' },
        { status: 400 }
      );
    }

    if (body.logs.length > 50) {
      return NextResponse.json(
        { error: 'Too many logs in a single batch (max 50)' },
        { status: 400 }
      );
    }

    const logs: LogEntry[] = body.logs as LogEntry[];
    const ingested: string[] = [];
    const failed: { index: number; error: string }[] = [];

    // Ingest each log
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Validate
      const validation = validateLog(log);
      if (!validation.valid) {
        failed.push({ index: i, error: validation.error || 'Validation failed' });
        continue;
      }

      try {
        // Insert into app_logs (user_id is set from session)
        const { error: insertError } = await supabase.from('app_logs').insert({
          user_id: user.id,
          level: log.level,
          area: log.area,
          message: log.message,
          meta: log.meta || {},
          fingerprint: log.fingerprint,
          url: log.url || null,
          user_agent: log.user_agent || null,
        });

        if (insertError) {
          failed.push({
            index: i,
            error: `Database error: ${insertError.message}`,
          });
        } else {
          ingested.push(log.fingerprint);
        }
      } catch (error) {
        failed.push({
          index: i,
          error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Return response
    return NextResponse.json(
      {
        success: true,
        ingested: ingested.length,
        failed: failed.length,
        ...(failed.length > 0 && { errors: failed }),
      },
      { status: 200 }
    );
  } catch (error) {
    logError("LogsIngest", { component: "logs.ingest", message: "Logs ingest error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || 'https://alphalog.io',
  'https://www.alphalog.io',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
];

/**
 * OPTIONS handler (for CORS preflight)
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
