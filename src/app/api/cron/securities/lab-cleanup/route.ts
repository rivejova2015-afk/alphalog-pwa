import { createServiceClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron job: Clean up expired and inactive lab sessions.
 * Runs daily to:
 * - Stop lab sessions inactive for >24 hours
 * - Delete temporary lab data
 * - Release allocated resources
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get('x-cron-secret');
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    let sessionsCleanedUp = 0;
    let sessionsTerminated = 0;

    // Calculate cutoff time (24 hours ago)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find inactive lab sessions
    const { data: inactiveSessions, error: fetchError } = await supabase
      .from('securities_lab_sessions')
      .select('id, lab_id, user_id, access_url')
      .eq('status', 'active')
      .lt('last_activity_at', cutoffTime)
      .is('deleted_at', null);

    if (fetchError) throw fetchError;

    if (inactiveSessions && inactiveSessions.length > 0) {
      // Terminate inactive sessions
      const sessionIds = inactiveSessions.map((s) => s.id);

      const { error: updateError } = await supabase
        .from('securities_lab_sessions')
        .update({
          status: 'terminated',
          terminated_at: new Date().toISOString(),
        })
        .in('id', sessionIds);

      if (updateError) throw updateError;
      sessionsTerminated = inactiveSessions.length;

      logInfo('SecurityLabCleanup', `Terminated ${sessionsTerminated} inactive lab sessions`);

      // Call lab cleanup API for each session if available
      for (const session of inactiveSessions) {
        try {
          if (session.access_url) {
            // Attempt to call cleanup endpoint on the lab VM
            await fetch(`${session.access_url}/api/cleanup`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.LAB_CLEANUP_TOKEN || ''}` },
              timeout: 5000,
            }).catch(() => null); // Silently ignore if lab is unreachable
          }
        } catch (err) {
          logError('SecurityLabCleanup', 'Failed to cleanup lab resources', {
            session_id: session.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }
    }

    // Delete soft-deleted lab sessions older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: oldDeletedSessions } = await supabase
      .from('securities_lab_sessions')
      .select('id')
      .eq('status', 'terminated')
      .lt('deleted_at', sevenDaysAgo);

    if (oldDeletedSessions && oldDeletedSessions.length > 0) {
      const { error: hardDeleteError } = await supabase
        .from('securities_lab_sessions')
        .delete()
        .in(
          'id',
          oldDeletedSessions.map((s) => s.id),
        );

      if (!hardDeleteError) {
        sessionsCleanedUp = oldDeletedSessions.length;
        logInfo('SecurityLabCleanup', `Hard-deleted ${sessionsCleanedUp} old terminated sessions`);
      }
    }

    // Cleanup expired lab temporary files
    try {
      const { data: expiredFiles } = await supabase.storage
        .from('lab-files')
        .list('', { limit: 1000 });

      if (expiredFiles) {
        const filesToDelete = expiredFiles
          .filter((file) => {
            const fileAge = Date.now() - new Date(file.updated_at).getTime();
            return fileAge > 7 * 24 * 60 * 60 * 1000; // Older than 7 days
          })
          .map((f) => f.name);

        if (filesToDelete.length > 0) {
          await supabase.storage.from('lab-files').remove(filesToDelete);
          logInfo('SecurityLabCleanup', `Deleted ${filesToDelete.length} expired lab files`);
        }
      }
    } catch (err) {
      logError('SecurityLabCleanup', 'Failed to cleanup storage files', {
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }

    return NextResponse.json({
      success: true,
      terminated: sessionsTerminated,
      cleaned_up: sessionsCleanedUp,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logError('SecurityLabCleanup', 'Cron job failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
