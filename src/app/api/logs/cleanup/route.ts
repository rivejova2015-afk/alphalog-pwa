/**
 * POST /api/logs/cleanup
 * Scheduled job to delete app_logs older than 30 days.
 * Requires: Authorization: Bearer <CRON_SECRET>
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { safeCompareTokens } from '@/lib/security/timing';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!safeCompareTokens(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
    }

    // Service role client — no cookies needed for cron operations
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('app_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString())
      .select();

    if (error) {
      console.error('Cleanup error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted: Array.isArray(data) ? data.length : 0,
      cutoffDate: thirtyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error('Cleanup handler error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
