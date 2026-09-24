import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import { createLabSnapshot } from '@/lib/securities/advanced-labs';

/**
 * GET /api/securities/labs/advanced/[environmentId]/snapshots
 * Fetch snapshots for a lab environment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ environmentId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { environmentId } = await params;

    // Verify ownership
    const { data: env, error: envError } = await supabase
      .from('securities_lab_environments')
      .select('user_id')
      .eq('id', environmentId)
      .single();

    if (envError || env.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch snapshots
    const { data: snapshots, error } = await supabase
      .from('securities_lab_snapshots')
      .select('*')
      .eq('environment_id', environmentId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(snapshots || [], {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    logError('SecuritySnapshotsAPI', 'Failed to fetch snapshots', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

/**
 * POST /api/securities/labs/advanced/[environmentId]/snapshots
 * Create a new snapshot
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ environmentId: string }> },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { environmentId } = await params;
    const body = await request.json();
    const { snapshot_name, description = '' } = body;

    if (!snapshot_name) {
      return NextResponse.json({ error: 'Missing snapshot_name' }, { status: 400 });
    }

    // Verify ownership
    const { data: env, error: envError } = await supabase
      .from('securities_lab_environments')
      .select('user_id')
      .eq('id', environmentId)
      .single();

    if (envError || env.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Create snapshot
    const snapshot = await createLabSnapshot(environmentId, snapshot_name, description);

    // Log audit trail
    await supabase.from('securities_lab_activity_logs').insert({
      environment_id: environmentId,
      user_id: user.id,
      activity_type: 'snapshot_created',
      activity_data: {
        snapshot_name,
        description,
      },
    });

    logInfo('SecuritySnapshotsAPI', `Created snapshot: ${snapshot_name}`, {
      environment_id: environmentId,
    });

    return NextResponse.json(snapshot, { status: 201 });
  } catch (err) {
    logError('SecuritySnapshotsAPI', 'Failed to create snapshot', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}
