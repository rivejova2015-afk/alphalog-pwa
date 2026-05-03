/**
 * Push-notification dispatcher for coinarb events (entries, exits, breakers,
 * daily summary). Posts to AlphaLog's `/api/push/notify-user` with a Bearer
 * token that AlphaLog validates against `ALPHALOG_PUSH_NOTIFY_TOKEN`.
 *
 * Fire-and-forget — bot never blocks on a push failure. Disable globally with
 * `COINARB_PUSH_ENABLED=false` to silence without redeploy.
 */

const NOTIFY_URL = process.env.ALPHALOG_PUSH_NOTIFY_URL ?? '';
const NOTIFY_TOKEN = process.env.ALPHALOG_PUSH_NOTIFY_TOKEN ?? '';
const ENABLED = process.env.COINARB_PUSH_ENABLED !== 'false';

export interface PushArgs {
  userId: string;
  title: string;
  body: string;
  tag?: string;
  data?: Record<string, string>;
}

export function notify(args: PushArgs): void {
  if (!ENABLED || !NOTIFY_URL || !NOTIFY_TOKEN) return;
  void (async () => {
    try {
      const res = await fetch(NOTIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${NOTIFY_TOKEN}`,
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        console.warn(`[notify-alphalog] ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.warn('[notify-alphalog] failed:', err instanceof Error ? err.message : String(err));
    }
  })();
}

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…';

export interface EntryNotice {
  venue: 'spot' | 'perp';
  symbol: string;
  side: 'BUY' | 'SELL';
  filledPrice: number;
  sizeUsd: number;
  reason: string;
  paper: boolean;
}

export function formatEntry(p: EntryNotice): { title: string; body: string } {
  const tag = p.paper ? 'PAPER' : 'LIVE';
  const verb = p.side === 'BUY' ? 'Long' : 'Short';
  return {
    title: `📈 Coinarb ${tag} · ${verb} ${p.symbol} @${p.filledPrice.toFixed(2)}`,
    body:  `$${p.sizeUsd.toFixed(2)} ${p.venue} · ${truncate(p.reason, 60)}`,
  };
}

export interface ExitNotice {
  venue: 'spot' | 'perp';
  symbol: string;
  pnlUsd: number;
  pnlPercent: number;
  exitPrice: number;
  reason: string;
  paper: boolean;
}

export function formatExit(p: ExitNotice): { title: string; body: string } {
  const tag = p.paper ? 'PAPER' : 'LIVE';
  const win = p.pnlUsd > 0;
  const sign = win ? '+' : '';
  return {
    title: `${win ? '✅ WIN' : '❌ LOSS'} Coinarb ${tag} ${sign}$${p.pnlUsd.toFixed(2)} (${sign}${p.pnlPercent.toFixed(1)}%)`,
    body:  `${p.symbol} ${p.venue} cerró @${p.exitPrice.toFixed(2)} · ${truncate(p.reason, 50)}`,
  };
}

export interface BreakerNotice {
  kind: 'drawdown' | 'cooldown' | 'daily_cap' | 'funding';
  message: string;
  paper: boolean;
}

export function formatBreaker(p: BreakerNotice): { title: string; body: string } {
  const tag = p.paper ? 'PAPER' : 'LIVE';
  return {
    title: `🛑 Coinarb ${tag} breaker (${p.kind})`,
    body:  truncate(p.message, 120),
  };
}

export interface DailyNotice {
  trades: number;
  pnlUsd: number;
  winRate: number;
  drawdownPct: number;
  paper: boolean;
}

export function formatDaily(p: DailyNotice): { title: string; body: string } {
  const tag = p.paper ? 'PAPER' : 'LIVE';
  const sign = p.pnlUsd >= 0 ? '+' : '';
  return {
    title: `📊 Coinarb ${tag} resumen 24h: ${sign}$${p.pnlUsd.toFixed(2)}`,
    body:  `${p.trades} trades · WR ${(p.winRate * 100).toFixed(0)}% · DD ${(p.drawdownPct * 100).toFixed(1)}%`,
  };
}
