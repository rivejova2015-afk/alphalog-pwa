/**
 * Fire-and-forget push notification dispatcher.
 *
 * Calls AlphaLog's /api/push/notify-user (Bearer-authenticated by INTERNAL_API_SECRET).
 * Never throws — bot trading must keep running even if notifications fail.
 *
 * Disable without redeploy: `fly secrets set POLYARB_PUSH_ENABLED=false`.
 */

const NOTIFY_URL      = process.env.ALPHALOG_PUSH_NOTIFY_URL ?? '';
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET     ?? '';
const ENABLED         = process.env.POLYARB_PUSH_ENABLED !== 'false';

export interface NotifyArgs {
  userId: string;
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, string>;
}

export function notifyTrade(args: NotifyArgs): void {
  if (!ENABLED || !NOTIFY_URL || !INTERNAL_SECRET) return;
  void (async () => {
    try {
      const res = await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${INTERNAL_SECRET}`,
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        console.warn(`[notify] push notify returned ${res.status}`);
      }
    } catch (err) {
      console.warn('[notify] push notify failed:', err instanceof Error ? err.message : String(err));
    }
  })();
}

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…';

export function formatEntry(p: {
  outcome: 'YES' | 'NO';
  side: 'BUY' | 'SELL';
  filledPrice: number;
  sizeUsd: number;
  marketTitle: string;
  slippageBps: number;
}): { title: string; body: string } {
  const action = p.side === 'BUY' ? 'Compra' : 'Venta';
  return {
    title: `📈 PolyArb · ${action} ${p.outcome} @${p.filledPrice.toFixed(2)}`,
    body:  `$${p.sizeUsd.toFixed(2)} en '${truncate(p.marketTitle, 40)}' · slip ${p.slippageBps}bps`,
  };
}

export function formatExit(p: {
  pnlUsd: number;
  pnlPercent: number;
  exitPrice: number;
  marketTitle: string;
}): { title: string; body: string } {
  const win = p.pnlUsd > 0;
  const sign = win ? '+' : '';
  return {
    title: `${win ? '✅ WIN' : '❌ LOSS'} PolyArb ${sign}$${p.pnlUsd.toFixed(2)} (${sign}${p.pnlPercent.toFixed(1)}%)`,
    body:  `cerró '${truncate(p.marketTitle, 40)}' a ${p.exitPrice.toFixed(2)}`,
  };
}
