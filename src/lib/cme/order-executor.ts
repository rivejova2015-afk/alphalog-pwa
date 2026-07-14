import type { DispatchDbClient } from '@/lib/engine/dispatchers/types';
import { readCmeAccessToken, storeCmeAccessToken } from './vault';
import { tradovateRenew, placeMarketOrder } from './tradovate';

export interface CmeSignal {
  id: string;
  userId: string;
  cmeAccountId: string;
  contract: string;
  direction: 'BUY' | 'SELL';
  quantity: number;
  stopLossTicks: number;
  takeProfitTicks: number;
  algorithmId?: string;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: number;
  fillPrice?: number;
  error?: string;
}

export async function executeSignal(
  signal: CmeSignal,
  svc: DispatchDbClient
): Promise<ExecutionResult> {
  const { data: conn, error: connErr } = await svc
    .from('cme_connections')
    .select('id, tradovate_account_id, tradovate_account_spec, token_expires_at, broker_type')
    .eq('user_id', signal.userId)
    .eq('cme_account_id', signal.cmeAccountId)
    .eq('status', 'connected')
    .maybeSingle();

  if (connErr || !conn) {
    return { success: false, error: 'no_active_connection' };
  }

  const { data: acct } = await svc
    .from('algo_cme_accounts')
    .select('is_paper')
    .eq('id', signal.cmeAccountId)
    .maybeSingle();

  const isPaper = acct?.is_paper ?? true;

  let token = await readCmeAccessToken(conn.id);
  if (!token) return { success: false, error: 'no_vault_token' };

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
  if (expiresAt && expiresAt < tenMinFromNow) {
    try {
      const renewed = await tradovateRenew(token, isPaper);
      token = renewed.accessToken;
      await storeCmeAccessToken(conn.id, token);
      await svc
        .from('cme_connections')
        .update({ token_expires_at: renewed.expirationTime })
        .eq('id', conn.id);
    } catch {
      // use existing token if renewal fails
    }
  }

  let orderId: number;
  try {
    const result = await placeMarketOrder({
      token,
      isPaper,
      accountSpec: conn.tradovate_account_spec,
      accountId: conn.tradovate_account_id,
      action: signal.direction === 'BUY' ? 'Buy' : 'Sell',
      symbol: signal.contract,
      qty: signal.quantity,
      slTicks: signal.stopLossTicks,
      tpTicks: signal.takeProfitTicks,
    });
    orderId = result.orderId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }

  await svc.from('cme_trades_propfirm').insert({
    user_id: signal.userId,
    cme_account_id: signal.cmeAccountId,
    connection_id: conn.id,
    algorithm_id: signal.algorithmId ?? null,
    signal_id: signal.id,
    contract: signal.contract,
    direction: signal.direction,
    quantity: signal.quantity,
    status: 'filled',
    broker_order_id: String(orderId),
    fill_timestamp: new Date().toISOString(),
  });

  await svc
    .from('cme_signals')
    .update({ status: 'executed', executed_at: new Date().toISOString() })
    .eq('id', signal.id);

  return { success: true, orderId };
}
