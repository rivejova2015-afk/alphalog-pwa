"use client";

import { TrendingUp, TrendingDown, Wallet, Building2, ChartBar } from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { CapitalLevelsData } from "@/lib/intelligence/metrics";

interface Props {
  data: CapitalLevelsData;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function CapitalLevelsPanel({ data }: Props) {
  if (!data.authenticated || data.totalAccounts === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin cuentas registradas"
        message="Agrega cuentas en /dashboard/tradehub para empezar a tracking de capital."
      />
    );
  }

  const utilizationPct = data.totalCapital > 0 ? data.totalBalance / data.totalCapital : 0;
  const realPct = data.totalCapital > 0 ? data.capitalByType.real.totalCapital / data.totalCapital : 0;
  const pfPct = data.totalCapital > 0 ? data.capitalByType.propfirm.totalCapital / data.totalCapital : 0;

  return (
    <div className="space-y-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Cuentas" value={data.totalAccounts.toString()} accent="#94a3b8" />
        <Tile label="Capital Total" value={fmtCurrency(data.totalCapital)} accent="#22d3ee" />
        <Tile label="Balance Total" value={fmtCurrency(data.totalBalance)} accent="#34d399" />
        <Tile
          label="P&L 30d"
          value={fmtCurrency(data.netPnl30d)}
          accent={data.netPnl30d >= 0 ? "#34d399" : "#ef4444"}
        />
      </div>

      {/* Utilization bar */}
      <section className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold">Utilización de capital</p>
          <p className="text-sm font-mono text-[#22d3ee] font-bold">{fmtPct(utilizationPct)}</p>
        </div>
        <div className="h-2 bg-[#1f2937] rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#22d3ee] to-[#34d399] transition-all"
            style={{ width: `${Math.min(100, utilizationPct * 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-[#475569] mt-1.5">
          {fmtCurrency(data.totalBalance)} de {fmtCurrency(data.totalCapital)} disponibles
        </p>
      </section>

      {/* Split: real vs propfirm */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TypeCard
          title="Cuentas reales"
          icon={Wallet}
          accent="#22d3ee"
          data={data.capitalByType.real}
          pct={realPct}
        />
        <TypeCard
          title="Propfirm"
          icon={Building2}
          accent="#a78bfa"
          data={data.capitalByType.propfirm}
          pct={pfPct}
        />
      </section>

      {/* Top accounts */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-2">
          <ChartBar size={14} /> Top cuentas por balance
        </h2>
        {data.topAccounts.length === 0 ? (
          <p className="text-xs text-[#475569]">No hay cuentas activas.</p>
        ) : (
          <ul className="space-y-2">
            {data.topAccounts.map((acc) => {
              const fillPct = acc.capital > 0 ? acc.balance / acc.capital : 0;
              const pnlPositive = acc.pnl30d >= 0;
              return (
                <li key={acc.id} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-bold text-[#e2e8f0] truncate">{acc.name}</p>
                    <span
                      className={`text-xs font-bold font-mono inline-flex items-center gap-0.5 ${
                        pnlPositive ? "text-[#34d399]" : "text-[#ef4444]"
                      }`}
                    >
                      {pnlPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {fmtCurrency(acc.pnl30d)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[#94a3b8] font-mono mb-1.5">
                    <span>{fmtCurrency(acc.balance)}</span>
                    <span className="text-[#475569]">/</span>
                    <span>{fmtCurrency(acc.capital)}</span>
                    <span className="text-[#475569]">·</span>
                    <span>{acc.currency}</span>
                  </div>
                  <div className="h-1.5 bg-[#1f2937] rounded overflow-hidden">
                    <div
                      className={`h-full ${pnlPositive ? "bg-[#34d399]" : "bg-[#ef4444]"}`}
                      style={{ width: `${Math.min(100, fillPct * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-xl font-bold font-mono mt-1" style={{ color: accent }}>{value}</p>
    </div>
  );
}

interface TypeCardProps {
  title: string;
  icon: typeof Wallet;
  accent: string;
  data: CapitalLevelsData["capitalByType"]["real"];
  pct: number;
}

function TypeCard({ title, icon: Icon, accent, data, pct }: TypeCardProps) {
  return (
    <div className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} style={{ color: accent }} />
        <p className="text-sm font-bold text-[#e2e8f0]">{title}</p>
        <span className="ml-auto text-xs font-mono text-[#94a3b8]">{fmtPct(pct)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Cuentas" value={data.totalAccounts.toString()} />
        <Stat label="Capital" value={fmtCurrency(data.totalCapital)} />
        <Stat label="Balance" value={fmtCurrency(data.totalBalance)} />
        <Stat
          label="P&L 30d"
          value={fmtCurrency(data.netPnl30d)}
          color={data.netPnl30d >= 0 ? "#34d399" : "#ef4444"}
        />
        <Stat label="Trades 30d" value={data.closedTrades30d.toString()} />
        <Stat label="Win rate" value={fmtPct(data.winRate30d)} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-sm font-mono font-bold" style={{ color: color ?? "#e2e8f0" }}>{value}</p>
    </div>
  );
}
