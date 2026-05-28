/**
 * POST /api/alphashield/audit
 * Ejecuta auditoría de sprints y guarda resultado en app_logs
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { auditSprints, type AuditReport } from '@/lib/alphashield/sprintAudit';
import { logger } from '@/lib/alphashield/logger';
import { logError as captureError } from "@/lib/log";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {
            // Cookies management not needed for response
          },
        },
      },
    );

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[AlphaShield Audit] Starting audit for user ${user.user.id}`);

    // Run audit
    const report = await auditSprints();

    // Save to app_logs
    const { error: logError } = await supabase.from('app_logs').insert({
      user_id: user.user.id,
      level: 'info',
      area: 'alphashield',
      message: 'status_audit',
      details: {
        audit: report,
        timestamp: new Date().toISOString(),
      },
      fingerprint: `alphashield_audit_${new Date().toISOString().split('T')[0]}`, // Dedup: 1 per day
    });

    if (logError) {
      captureError("AlphaShield Audit", { component: "alphashield.audit", message: "Error saving to app_logs:", error: logError instanceof Error ? logError.message : String(logError) });
      // Don't fail the request, just log the error
      await logger.warn('alphashield', 'Failed to save audit to app_logs', {
        error: logError.message,
        userId: user.user.id,
      });
    } else {
      console.log(`[AlphaShield Audit] Audit saved to app_logs`);
    }

    // Return audit report
    return NextResponse.json({
      ok: true,
      report,
      generatedAt: report.generatedAt,
    });
  } catch (error) {
    captureError("AlphaShield Audit", { component: "alphashield.audit", message: "Unexpected error:", error: error instanceof Error ? error.message : String(error) });

    await logger.error('alphashield', 'Audit execution failed', error as Error, {
      stack: (error as Error).stack,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/alphashield/audit
 * Retrieve last audit report from app_logs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {
            // Cookies management not needed for response
          },
        },
      },
    );

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get last audit from app_logs
    const { data: logs, error: logsError } = await supabase
      .from('app_logs')
      .select('*')
      .eq('user_id', user.user.id)
      .eq('area', 'alphashield')
      .eq('message', 'status_audit')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (logsError && logsError.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected if no audit yet)
      captureError("AlphaShield Audit", { component: "alphashield.audit", message: "Error fetching last audit:", error: logsError instanceof Error ? logsError.message : String(logsError) });
      return NextResponse.json(
        { error: 'Failed to fetch audit' },
        { status: 500 },
      );
    }

    const report = logs?.details?.audit || null;

    return NextResponse.json({
      ok: true,
      report,
      lastGeneratedAt: logs?.created_at || null,
    });
  } catch (error) {
    captureError("AlphaShield Audit GET", { component: "alphashield.audit", message: "Unexpected error:", error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
