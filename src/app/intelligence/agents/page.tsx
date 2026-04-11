import { Bot, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AgentsList } from "@/components/intelligence/agents/AgentsList.client";

export default async function AgentsDashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const agents = userData?.user
    ? (await supabase
        .from("agents")
        .select("*")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("sort_index", { ascending: true })
      ).data ?? []
    : [];

  const active = agents.filter((a) => a.status === "running");
  const totalPortfolio = agents.reduce((sum, a) => sum + (a.portfolio_usd ?? 0), 0);
  const avgWinRate = agents.length > 0
    ? agents.reduce((sum, a) => sum + (a.win_rate ?? 0), 0) / agents.length
    : 0;
  const avgRoi = agents.length > 0
    ? agents.reduce((sum, a) => sum + (a.roi_percent ?? 0), 0) / agents.length
    : 0;

  // Map DB rows to AgentCard shape
  const agentData = agents.map((a) => ({
    id: a.id as string,
    name: a.name as string,
    type: (a.type as string) === "polyarb" ? "polymarket" as const : "custom_ia" as const,
    status: a.status === "running" ? "ACTIVE" as const : a.status === "paused" ? "PAUSED" as const : "ERROR" as const,
    portfolioValue: a.portfolio_usd as number ?? 0,
    winRate: a.win_rate as number ?? 0,
    roi: a.roi_percent as number ?? 0,
    sharpeRatio: a.sharpe_ratio as number ?? 0,
    maxDrawdown: -(a.max_drawdown_pct as number ?? 0),
    lastTradeTime: "—",
  }));

  const stats = [
    { label: "Active Agents", value: active.length.toString(), color: "#34d399" },
    { label: "Total Portfolio", value: `$${totalPortfolio.toLocaleString()}`, color: "#22d3ee" },
    { label: "Avg Win Rate", value: `${avgWinRate.toFixed(1)}%`, color: "#34d399" },
    { label: "Combined ROI", value: `${avgRoi >= 0 ? "+" : ""}${avgRoi.toFixed(1)}%`, color: avgRoi >= 0 ? "#34d399" : "#ef4444" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <Bot size={22} className="text-[#22d3ee]" />
            Agents Dashboard
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">AI agents monitoring and control</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-[#22d3ee] hover:bg-[#06b6d4] text-[#0a0e1a] text-sm font-bold rounded transition-colors">
          <Plus size={16} />
          New Agent
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {agentData.length === 0 ? (
        <div className="text-center py-20">
          <Bot size={40} className="text-[#1f2937] mx-auto mb-4" />
          <p className="text-[#475569] text-sm">No agents configured yet.</p>
          <p className="text-[#2d3748] text-xs mt-1">Create your first agent to start monitoring.</p>
        </div>
      ) : (
        <AgentsList agents={agentData} />
      )}
    </div>
  );
}
