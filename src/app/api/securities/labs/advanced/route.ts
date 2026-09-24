import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/log';

/**
 * GET /api/securities/labs/advanced
 * Fetch advanced lab environments for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch lab environments
    const { data: labs, error } = await supabase
      .from('securities_lab_environments')
      .select('id, lab_id, status, docker_image, created_at, snapshot_count')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(labs || [], {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    logError('SecurityLabsAPI', 'Failed to fetch advanced labs', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to fetch labs' }, { status: 500 });
  }
}

/**
 * POST /api/securities/labs/advanced
 * Create a new advanced lab environment
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

    // Insert new lab environment
    const { data: lab, error } = await supabase
      .from('securities_lab_environments')
      .insert({
        user_id: user.id,
        lab_id,
        status: 'provisioning',
        docker_image: `alphalog-lab:${tools.sort().join('-')}-latest`,
        exposed_ports: {
          ghidra: 8080,
          burp: 8081,
          metasploit: 4444,
          wireshark: 9999,
        },
      })
      .select()
      .single();

    if (error) throw error;

    logInfo('SecurityLabsAPI', 'Created new lab environment', {
      user_id: user.id,
      lab_id,
      tools,
    });

    return NextResponse.json(lab, { status: 201 });
  } catch (err) {
    logError('SecurityLabsAPI', 'Failed to create lab environment', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to create lab' }, { status: 500 });
  }
}
