// PDF generation was removed: @react-pdf/renderer 3.4.5 throws
// `Cannot read properties of undefined (reading 'hasOwnProperty')`
// against React 19 internals. The audit-grade data lives in the CSVs;
// this file now produces a plain-text summary instead.

export interface PolyarbArchiveTrade {
  id: string;
  trade_type: string;
  market_slug: string | null;
  outcome: string | null;
  side: string;
  price: number;
  size_usd: number | null;
  fee_usd: number | null;
  pnl_usd: number | null;
  status: string;
  executed_at: string;
}

export interface PolyarbArchivePosition {
  id: string;
  market_slug: string;
  outcome: string;
  side: string;
  status: string;
  entry_price: number | null;
  exit_price: number | null;
  size_usd: number | null;
  pnl_usd: number | null;
  pnl_percent: number | null;
  opened_at: string | null;
  closed_at: string | null;
  exit_reason: string | null;
}

export interface PolyarbArchiveEquitySnapshot {
  snapshot_at: string;
  equity_usd: number;
  pnl_usd: number;
  open_positions: number;
}

export interface PolyarbArchiveDataset {
  agentId: string;
  agentName: string;
  trades: PolyarbArchiveTrade[];
  positions: PolyarbArchivePosition[];
  equitySnapshots: PolyarbArchiveEquitySnapshot[];
  telemetrySnapshot: Record<string, unknown> | null;
}

export interface PolyarbArchiveSummary {
  periodStart: string;
  periodEnd: string;
  tradeCount: number;
  closedPositionCount: number;
  totalPnlUsd: number;
  totalFeesUsd: number;
  winRate: number;
  largestWinUsd: number;
  largestLossUsd: number;
  netReturnPct: number | null;
}

const num = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fmtUsd = (v: number) => `$${v.toFixed(2)}`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

const earliestExecutedAt = (d: PolyarbArchiveDataset): string | null => {
  let earliest: number | null = null;
  for (const t of d.trades) {
    const ts = Date.parse(t.executed_at);
    if (!Number.isFinite(ts)) continue;
    if (earliest === null || ts < earliest) earliest = ts;
  }
  for (const p of d.positions) {
    const ts = Date.parse(p.opened_at ?? "");
    if (!Number.isFinite(ts)) continue;
    if (earliest === null || ts < earliest) earliest = ts;
  }
  return earliest === null ? null : new Date(earliest).toISOString();
};

const latestExecutedAt = (d: PolyarbArchiveDataset): string | null => {
  let latest: number | null = null;
  for (const t of d.trades) {
    const ts = Date.parse(t.executed_at);
    if (!Number.isFinite(ts)) continue;
    if (latest === null || ts > latest) latest = ts;
  }
  for (const p of d.positions) {
    const ts = Date.parse(p.closed_at ?? p.opened_at ?? "");
    if (!Number.isFinite(ts)) continue;
    if (latest === null || ts > latest) latest = ts;
  }
  return latest === null ? null : new Date(latest).toISOString();
};

export function buildSummary(d: PolyarbArchiveDataset): PolyarbArchiveSummary {
  const closed = d.positions.filter((p) => p.status === "CLOSED" || p.status === "LIQUIDATED");
  const wins = closed.filter((p) => num(p.pnl_usd) > 0);
  const winRate = closed.length > 0 ? wins.length / closed.length : 0;

  const totalPnlFromTrades = d.trades.reduce((acc, t) => acc + num(t.pnl_usd), 0);
  const totalPnlFromPositions = closed.reduce((acc, p) => acc + num(p.pnl_usd), 0);
  const totalPnlUsd = totalPnlFromTrades !== 0 ? totalPnlFromTrades : totalPnlFromPositions;

  const totalFeesUsd = d.trades.reduce((acc, t) => acc + num(t.fee_usd), 0);

  let largestWinUsd = 0;
  let largestLossUsd = 0;
  for (const p of closed) {
    const pnl = num(p.pnl_usd);
    if (pnl > largestWinUsd) largestWinUsd = pnl;
    if (pnl < largestLossUsd) largestLossUsd = pnl;
  }

  let netReturnPct: number | null = null;
  if (d.equitySnapshots.length >= 2) {
    const sorted = [...d.equitySnapshots].sort(
      (a, b) => Date.parse(a.snapshot_at) - Date.parse(b.snapshot_at),
    );
    const start = num(sorted[0].equity_usd);
    const end = num(sorted[sorted.length - 1].equity_usd);
    if (start > 0) netReturnPct = ((end - start) / start) * 100;
  }

  const periodStart = earliestExecutedAt(d) ?? new Date().toISOString();
  const periodEnd = latestExecutedAt(d) ?? new Date().toISOString();

  return {
    periodStart,
    periodEnd,
    tradeCount: d.trades.length,
    closedPositionCount: closed.length,
    totalPnlUsd,
    totalFeesUsd,
    winRate,
    largestWinUsd,
    largestLossUsd,
    netReturnPct,
  };
}

const csvEscape = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const csvRow = (values: unknown[]): string => values.map(csvEscape).join(",");

export function buildTradesCsv(d: PolyarbArchiveDataset): string {
  const header = [
    "id",
    "trade_type",
    "market_slug",
    "outcome",
    "side",
    "price",
    "size_usd",
    "fee_usd",
    "pnl_usd",
    "status",
    "executed_at",
  ];
  const rows = d.trades.map((t) =>
    csvRow([
      t.id,
      t.trade_type,
      t.market_slug,
      t.outcome,
      t.side,
      t.price,
      t.size_usd,
      t.fee_usd,
      t.pnl_usd,
      t.status,
      t.executed_at,
    ]),
  );
  return [csvRow(header), ...rows].join("\n");
}

export function buildPositionsCsv(d: PolyarbArchiveDataset): string {
  const header = [
    "id",
    "market_slug",
    "outcome",
    "side",
    "status",
    "entry_price",
    "exit_price",
    "size_usd",
    "pnl_usd",
    "pnl_percent",
    "opened_at",
    "closed_at",
    "exit_reason",
  ];
  const rows = d.positions.map((p) =>
    csvRow([
      p.id,
      p.market_slug,
      p.outcome,
      p.side,
      p.status,
      p.entry_price,
      p.exit_price,
      p.size_usd,
      p.pnl_usd,
      p.pnl_percent,
      p.opened_at,
      p.closed_at,
      p.exit_reason,
    ]),
  );
  return [csvRow(header), ...rows].join("\n");
}

export function buildEquityCsv(d: PolyarbArchiveDataset): string {
  const header = ["snapshot_at", "equity_usd", "pnl_usd", "open_positions"];
  const rows = d.equitySnapshots.map((s) =>
    csvRow([s.snapshot_at, s.equity_usd, s.pnl_usd, s.open_positions]),
  );
  return [csvRow(header), ...rows].join("\n");
}

export async function renderArchivePdf(
  d: PolyarbArchiveDataset,
  s: PolyarbArchiveSummary,
): Promise<Buffer> {
  const periodStartDate = s.periodStart.slice(0, 10);
  const periodEndDate = s.periodEnd.slice(0, 10);
  const lines = [
    `PolyArb 500x — Historical Archive (${periodStartDate} → ${periodEndDate})`,
    `Agent: ${d.agentName} (${d.agentId})`,
    "",
    `Snapshot of ${s.tradeCount} trades, ${s.closedPositionCount} closed positions.`,
    `Net P&L ${fmtUsd(s.totalPnlUsd)}, win rate ${fmtPct(s.winRate)}.`,
    "Generated immutable for audit before strategy reset.",
    "",
    "Period",
    `  Start: ${s.periodStart}`,
    `  End:   ${s.periodEnd}`,
    "",
    "Activity",
    `  Trades:            ${s.tradeCount}`,
    `  Closed positions:  ${s.closedPositionCount}`,
    `  Total fees:        ${fmtUsd(s.totalFeesUsd)}`,
    "",
    "Outcome",
    `  Net P&L:       ${fmtUsd(s.totalPnlUsd)}`,
    `  Win rate:      ${fmtPct(s.winRate)}`,
    `  Largest win:   ${fmtUsd(s.largestWinUsd)}`,
    `  Largest loss:  ${fmtUsd(s.largestLossUsd)}`,
    `  Net return:    ${s.netReturnPct !== null ? s.netReturnPct.toFixed(2) + "%" : "n/a"}`,
    "",
    "Notes",
    "  Source tables: polyarb_trades, polyarb_positions, polyarb_equity_snapshots.",
    "  Compliance audit trail (polyarb_compliance_audit) untouched and remains queryable.",
    "  Reversibility: archived_at can be cleared to restore rows to the live dashboard.",
  ];
  return Buffer.from(lines.join("\n"), "utf-8");
}
