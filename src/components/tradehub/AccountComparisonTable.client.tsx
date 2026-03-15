// src/components/tradehub/AccountComparisonTable.client.tsx
"use client";

import { useEffect, useState } from "react";
import { computePnlTotals, filterTradesForPnl } from "@/lib/metrics/pnl";

interface Account {
  id: string;
  name: string;
  currency: string;
  current_balance: number | null;
  account_size: number | null;
  status: string;
  category?: { name: string } | null;
}

interface AccountRow {
  account: Account;
  wins: number;
  losses: number;
  ops: number;
  winRate: number | null;
  totalPnl: number;
  topSetup: string | null;
  loading: boolean;
}

type SortKey = "name" | "winRate" | "ops" | "totalPnl" | "balance";

function formatCurrency(val: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
  } catch {
    return val.toFixed(0);
  }
}

function WinRateBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500">—</span>;
  const color = value >= 60 ? "text-emerald-400" : value >= 50 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-semibold ${color}`}>{value}%</span>;
}

export default function AccountComparisonTable() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [sortKey, setSortKey] = useState<SortKey>("totalPnl");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const accounts: Account[] = await res.json();
        if (!Array.isArray(accounts) || accounts.length === 0) {
          setRows([]);
          setStatus("ok");
          return;
        }

        // Initialize rows with loading state
        setRows(
          accounts.map((account) => ({
            account,
            wins: 0,
            losses: 0,
            ops: 0,
            winRate: null,
            totalPnl: 0,
            topSetup: null,
            loading: true,
          }))
        );
        setStatus("ok");

        // Fetch stats per account
        await Promise.all(
          accounts.map(async (account) => {
            try {
              const params = new URLSearchParams({
                accountId: account.id,
                closedOnly: "true",
                range: "all",
                limit: "200",
                offset: "0",
              });
              const r = await fetch(`/api/tradehub/trades?${params.toString()}`);
              const trades = r.ok ? ((await r.json().catch(() => [])) as any[]) : [];
              const tradeList = Array.isArray(trades) ? trades : [];
              const metrics = computePnlTotals(tradeList, {
                closedOnly: true,
                requireExitDate: true,
                ignoreZero: true,
              });
              const closed = filterTradesForPnl(tradeList, {
                closedOnly: true,
                requireExitDate: true,
                ignoreZero: true,
              });
              const totalPnl = closed.reduce((sum, t: any) => sum + (t.pnl || 0), 0);

              // Top setup
              const setupCounts = new Map<string, number>();
              closed.forEach((t: any) => {
                const key = t.setup?.name || null;
                if (key) setupCounts.set(key, (setupCounts.get(key) ?? 0) + 1);
              });
              const topSetup =
                setupCounts.size > 0
                  ? Array.from(setupCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
                  : null;

              setRows((prev) =>
                prev.map((row) =>
                  row.account.id === account.id
                    ? {
                        ...row,
                        wins: metrics.wins,
                        losses: metrics.losses,
                        ops: metrics.ops,
                        winRate: metrics.winRate !== null ? Math.round(metrics.winRate) : null,
                        totalPnl,
                        topSetup,
                        loading: false,
                      }
                    : row
                )
              );
            } catch {
              setRows((prev) =>
                prev.map((row) =>
                  row.account.id === account.id ? { ...row, loading: false } : row
                )
              );
            }
          })
        );
      } catch {
        setStatus("error");
      }
    }
    void load();
  }, []);

  const sorted = [...rows].sort((a, b) => {
    let av: number, bv: number;
    switch (sortKey) {
      case "name":
        return sortAsc
          ? a.account.name.localeCompare(b.account.name)
          : b.account.name.localeCompare(a.account.name);
      case "winRate":
        av = a.winRate ?? -Infinity;
        bv = b.winRate ?? -Infinity;
        break;
      case "ops":
        av = a.ops;
        bv = b.ops;
        break;
      case "totalPnl":
        av = a.totalPnl;
        bv = b.totalPnl;
        break;
      case "balance":
        av = a.account.current_balance ?? -Infinity;
        bv = b.account.current_balance ?? -Infinity;
        break;
      default:
        return 0;
    }
    return sortAsc ? av - bv : bv - av;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function SortTh({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col;
    return (
      <th
        className="px-3 py-2 text-left text-xs text-slate-400 cursor-pointer select-none hover:text-slate-200 whitespace-nowrap"
        onClick={() => toggleSort(col)}
      >
        {label}
        {active && (
          <span className="ml-1 text-slate-500">{sortAsc ? "▲" : "▼"}</span>
        )}
      </th>
    );
  }

  if (status === "loading") {
    return (
      <div className="animate-pulse h-32 rounded-2xl border border-slate-700/40 bg-slate-800/60" />
    );
  }

  if (status === "error") {
    return (
      <p className="text-sm text-red-400">No se pudo cargar la comparación de cuentas.</p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Crea cuentas para ver la comparación aquí.
      </p>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-700/70 bg-slate-900/70 shadow-[0_18px_40px_rgba(2,4,10,0.45)] backdrop-blur overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
        <h3 className="display-font text-lg font-semibold text-slate-100">
          Comparación de Cuentas
        </h3>
        <span className="text-xs text-slate-500">{rows.length} cuentas</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm text-slate-200">
          <thead>
            <tr className="border-b border-slate-800">
              <SortTh col="name" label="Cuenta" />
              <th className="px-3 py-2 text-left text-xs text-slate-400">Categoría</th>
              <SortTh col="balance" label="Balance" />
              <SortTh col="ops" label="Trades" />
              <SortTh col="winRate" label="Win Rate" />
              <SortTh col="totalPnl" label="P&L Total" />
              <th className="px-3 py-2 text-left text-xs text-slate-400">Top Setup</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const pnlColor =
                row.loading
                  ? "text-slate-500"
                  : row.totalPnl > 0
                  ? "text-emerald-400"
                  : row.totalPnl < 0
                  ? "text-red-400"
                  : "text-slate-400";

              return (
                <tr
                  key={row.account.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/30 transition"
                >
                  <td className="px-3 py-3 font-medium text-slate-100">
                    {row.account.name}
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs">
                    {row.account.category?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-300">
                    {row.account.current_balance !== null
                      ? formatCurrency(row.account.current_balance, row.account.currency)
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    {row.loading ? (
                      <span className="text-slate-600">…</span>
                    ) : (
                      <span>
                        {row.ops}{" "}
                        <span className="text-slate-500 text-xs">
                          ({row.wins}W/{row.losses}L)
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {row.loading ? (
                      <span className="text-slate-600">…</span>
                    ) : (
                      <WinRateBadge value={row.winRate} />
                    )}
                  </td>
                  <td className={`px-3 py-3 font-semibold ${pnlColor}`}>
                    {row.loading
                      ? "…"
                      : row.ops === 0
                      ? "—"
                      : formatCurrency(row.totalPnl, row.account.currency)}
                  </td>
                  <td className="px-3 py-3 text-slate-400 text-xs">
                    {row.loading ? "…" : row.topSetup ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
