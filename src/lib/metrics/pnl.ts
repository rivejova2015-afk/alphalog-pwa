export interface PnlTradeLike {
  pnl?: number | string | null;
  status?: string | null;
  exit_date?: string | null;
}

export interface PnlFilterOptions {
  closedOnly?: boolean;
  requireExitDate?: boolean;
  ignoreZero?: boolean;
}

export interface PnlTotals {
  totalPnl: number;
  wins: number;
  losses: number;
  ops: number;
  winRate: number | null;
  avgPnl: number | null;
  tradeCount: number;
}

const DEFAULT_FILTERS: Required<PnlFilterOptions> = {
  closedOnly: true,
  requireExitDate: true,
  ignoreZero: true,
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = value.replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isClosedTrade(trade: PnlTradeLike, requireExitDate: boolean): boolean {
  const hasExitDate = Boolean(trade.exit_date);
  if (requireExitDate) return hasExitDate;

  const status = typeof trade.status === "string" ? trade.status.toLowerCase() : "";
  return status === "closed" || hasExitDate;
}

export function filterTradesForPnl(
  trades: PnlTradeLike[] = [],
  options: PnlFilterOptions = {}
): PnlTradeLike[] {
  const { closedOnly, requireExitDate, ignoreZero } = { ...DEFAULT_FILTERS, ...options };

  return trades.filter((trade) => {
    if (closedOnly && !isClosedTrade(trade, requireExitDate)) {
      return false;
    }

    const pnlValue = toNumber(trade.pnl);
    if (pnlValue === null) return false;
    if (ignoreZero && pnlValue === 0) return false;

    return true;
  });
}

export function computePnlTotals(
  trades: PnlTradeLike[] = [],
  options: PnlFilterOptions = {}
): PnlTotals {
  const filtered = filterTradesForPnl(trades, options);

  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  filtered.forEach((trade) => {
    const pnlValue = toNumber(trade.pnl) ?? 0;
    totalPnl += pnlValue;
    if (pnlValue > 0) wins += 1;
    if (pnlValue < 0) losses += 1;
  });

  const ops = wins + losses;
  const winRate = ops > 0 ? (wins / ops) * 100 : null;
  const avgPnl = ops > 0 ? totalPnl / ops : null;

  return {
    totalPnl,
    wins,
    losses,
    ops,
    winRate,
    avgPnl,
    tradeCount: filtered.length,
  };
}
