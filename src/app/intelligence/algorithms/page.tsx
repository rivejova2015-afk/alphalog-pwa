import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AlgoAccordion } from "@/components/intelligence/algorithms/AlgoAccordion.client";
import { NewStrategyButton } from "@/components/intelligence/algorithms/NewStrategyButton.client";
import CmeAlgoTabs from "@/components/intelligence/algorithms/CmeAlgoTabs.client";

export default async function AlgorithmsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const algorithms = userData?.user
    ? (await supabase
        .from("algorithms")
        .select("*")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true })
      ).data ?? []
    : [];

  const active = algorithms.filter((a) => a.status === "running");
  const pnlToday = algorithms.reduce((sum, a) => sum + (a.pnl_today ?? 0), 0);
  const avgWinRate = algorithms.length > 0
    ? algorithms.reduce((sum, a) => sum + (a.win_rate ?? 0), 0) / algorithms.length
    : 0;
  const totalTrades = algorithms.reduce((sum, a) => sum + (a.trade_count ?? 0), 0);

  type MarketType = 'forex' | 'futures' | 'options';
  type Direction  = 'long' | 'short' | 'both';

  // Map DB rows to AlgoAccordion shape
  const algos = algorithms.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    marketType: (["forex","futures","options"].includes(a.market_type as string) ? a.market_type : "forex") as MarketType,
    instrument: a.instrument as string ?? "XAUUSD",
    direction: (["long","short","both"].includes(a.direction as string) ? a.direction : "both") as Direction,
    parameters: (a.parameters as Record<string, unknown>) ?? {},
    status: a.status === "running" ? "ACTIVE" as const : a.status === "paused" ? "PAUSED" as const : "ERROR" as const,
    pnlToday: (a.pnl_today ?? 0) as number,
    pnlTotal: (a.pnl_total ?? 0) as number,
    winRate: (a.win_rate ?? 0) as number,
    totalTrades: (a.trade_count ?? 0) as number,
    profitFactor: (a.profit_factor ?? 0) as number,
    maxDrawdown: -((a.max_drawdown_pct ?? 0) as number),
  }));

  const stats = [
    { label: "Active Strategies", value: active.length.toString(), color: "#34d399" },
    { label: "P&L Today", value: `${pnlToday >= 0 ? "+" : ""}$${Math.abs(pnlToday).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: pnlToday >= 0 ? "#34d399" : "#ef4444" },
    { label: "Avg Win Rate", value: `${avgWinRate.toFixed(1)}%`, color: "#22d3ee" },
    { label: "Total Trades", value: totalTrades.toLocaleString(), color: "#94a3b8" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <TrendingUp size={22} className="text-[#34d399]" />
            Algorithmic Trading
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Forex and futures algorithm strategies</p>
        </div>
        <NewStrategyButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {algos.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp size={40} className="text-[#1f2937] mx-auto mb-4" />
          <p className="text-[#475569] text-sm">No strategies configured yet.</p>
          <p className="text-[#2d3748] text-xs mt-1">Create your first strategy to start tracking performance.</p>
        </div>
      ) : (
        <AlgoAccordion algos={algos} />
      )}

      <div className="mt-8">
        <CmeAlgoTabs />
      </div>
    </div>
  );
}
