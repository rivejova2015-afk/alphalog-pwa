import { createServiceClient } from '@/lib/supabase/server';

function vaultKey(connectionId: string): string {
  return `cme-access:${connectionId}`;
}

export async function storeCmeAccessToken(connectionId: string, token: string): Promise<void> {
  const supabase = createServiceClient();
  const key = vaultKey(connectionId);

  const { error } = await supabase.rpc('store_vault_secret', {
    p_name: key,
    p_secret: token,
  });

  if (error) throw new Error(`storeCmeAccessToken: ${error.message}`);
}

export async function readCmeAccessToken(connectionId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const key = vaultKey(connectionId);

  const { data, error } = await supabase.rpc('read_vault_secret', { p_name: key });

  if (error) return null;
  return (data as string | null) ?? null;
}

export async function deleteCmeAccessToken(connectionId: string): Promise<void> {
  const supabase = createServiceClient();
  const key = vaultKey(connectionId);

  await supabase.rpc('store_vault_secret', { p_name: key, p_secret: '' }).catch(() => {});
}
