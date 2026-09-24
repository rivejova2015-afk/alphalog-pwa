import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';
import { provisionLabEnvironment } from '@/lib/securities/advanced-labs';

/**
 * POST /api/securities/labs/advanced/provision
 * Provision a Docker-based lab environment
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lab_id, tools = ['ghidra', 'burp', 'metasploit'] } = body;

    if (!lab_id) {
      return NextResponse.json({ error: 'Missing lab_id' }, { status: 400 });
    }

    // Check user's lab quota (max 5 concurrent labs per user)
    const { count: activeCount, error: countError } = await supabase
      .from('securities_lab_environments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'running')
      .is('deleted_at', null);

    if (countError) throw countError;

    if ((activeCount || 0) >= 5) {
      return NextResponse.json(
        { error: 'Maximum concurrent labs reached (5)' },
        { status: 429 },
      );
    }

    // Provision the lab
    const labEnv = await provisionLabEnvironment(user.id, lab_id, tools);

    // Log audit trail
    await supabase.from('securities_lab_activity_logs').insert({
      environment_id: labEnv.id,
      user_id: user.id,
      activity_type: 'environment_provisioned',
      activity_data: {
        tools,
        status: 'running',
      },
    });

    logInfo('SecurityLabsAPI', `Provisioned lab for user ${user.id}`, {
      lab_id,
      environment_id: labEnv.id,
      tools,
    });

    return NextResponse.json(labEnv, { status: 201 });
  } catch (err) {
    logError('SecurityLabsAPI', 'Failed to provision lab', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to provision lab' }, { status: 500 });
  }
}
