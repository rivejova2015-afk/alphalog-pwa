import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CommandSchema = z.object({
  agentId: z.string().uuid(),
  action: z.enum(['start', 'stop', 'pause', 'resume']),
});

const ACTION_TO_STATUS: Record<string, string> = {
  start: 'RUNNING',
  stop: 'STOPPED',
  pause: 'PAUSED',
  resume: 'RUNNING',
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = CommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid command', details: parsed.error.issues }, { status: 400 });
  }

  const { agentId, action } = parsed.data;
  const newStatus = ACTION_TO_STATUS[action];

  // Verify ownership
  const { data: agent } = await supabase
    .from('polyarb_agents')
    .select('id, status')
    .eq('id', agentId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .single();

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const previousStatus = agent.status;

  // Update status (engine polls this every 5s)
  const { error } = await supabase
    .from('polyarb_agents')
    .update({ status: newStatus })
    .eq('id', agentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Write compliance audit
  await supabase.from('polyarb_compliance_audit').insert({
    user_id: user.id,
    agent_id: agentId,
    event_type: `AGENT_${action.toUpperCase()}`,
    before_state: { status: previousStatus },
    after_state: { status: newStatus },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
