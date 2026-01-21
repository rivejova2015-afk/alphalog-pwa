/**
 * POST /api/logs/cleanup
 * Scheduled job to delete logs older than 30 days
 *
 * This endpoint is optional and demonstrates one way to handle
 * 30-day log retention. For production, a Supabase Scheduled SQL (cron)
 * is recommended instead.
 *
 * Requires:
 * - Valid CRON_SECRET (matches environment variable)
 *
 * Call this via a scheduler (Vercel Cron, AWS Lambda, n8n, etc.):
 * POST /api/logs/cleanup
 * Authorization: Bearer <CRON_SECRET>
 *
 * Response:
 * {
 *   success: true,
 *   deleted: 42
 * }
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST handler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Create Supabase client (server-side, with service role)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for admin access
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

    // Calculate cutoff date (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete logs older than 30 days
    const { data, error, count } = await supabase
      .from('app_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .select(); // Add select to get count

    if (error) {
      console.error('Cleanup error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deleted: Array.isArray(data) ? data.length : count || 0,
        cutoffDate: thirtyDaysAgo.toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Cleanup handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
