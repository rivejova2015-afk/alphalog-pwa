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
        .from("trading_algorithms")
        .select(`
          *,
          deployments:algorithm_deployments(
            id, status, bot_account_id
          )
        `)
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("slot_number", { ascending: true })
      ).data ?? []
    : [];

  const active = algorithms.filter((a) => a.status === "live");

  type MarketType = 'forex' | 'futures' | 'options';
  type Direction  = 'long' | 'short' | 'both';

  const algos = algorithms.map((a) => {
    const params = (a.parameters as Record<string, unknown>) ?? {};
    const deployments = (a.deployments as { id: string; status: string; bot_account_id: string | null }[] | null) ?? [];
    const activeDeployment = deployments.find((d) => d.status === "active") ?? deployments[0] ?? null;

    const marketType: MarketType =
      a.algo_type === "arbitrage" ? "futures" : "forex";

    const status =
      a.status === "live" ? ("ACTIVE" as const) :
      a.status === "paused" ? ("PAUSED" as const) :
      "PAUSED" as const;

    return {
      id: a.id as string,
      name: a.name as string,
      marketType,
      instrument: (params.instrument as string) ?? (params.trade_symbol as string) ?? "XAUUSD",
      direction: (["long","short","both"].includes(params.direction as string) ? params.direction : "both") as Direction,
      parameters: params,
      status,
      algoStatus: a.status as string,
      linkedBotAccountId: activeDeployment?.bot_account_id ?? null,
      pnlToday: 0,
      pnlTotal: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      maxDrawdown: 0,
    };
  });

  const stats = [
    { label: "Active Strategies", value: active.length.toString(), color: "#34d399" },
    { label: "P&L Today", value: "+$0.00", color: "#34d399" },
    { label: "Avg Win Rate", value: "—", color: "#22d3ee" },
    { label: "Total Trades", value: "0", color: "#94a3b8" },
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
