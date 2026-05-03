import type { SupabaseClient } from '@supabase/supabase-js';

export interface CoinarbAgentRow {
  id: string;
  user_id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'ERROR';
  starting_capital_usd: number | null;
  last_heartbeat_at: string | null;
  config: Record<string, unknown>;
  fly_instance_id: string | null;
  created_at: string;
}

export async function getCoinarbAgent(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoinarbAgentRow | null> {
  const { data } = await supabase
    .from('coinarb_agents')
    .select('id, user_id, name, status, starting_capital_usd, last_heartbeat_at, config, fly_instance_id, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as CoinarbAgentRow | null) ?? null;
}
