import { Bot, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AgentsDashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Query polyarb_agents (the real table — not the generic "agents" table)
  const { data: polyarbAgents } = userData?.user
    ? await supabase
        .from("polyarb_agents")
        .select("id, name, status, starting_capital_usd, last_heartbeat_at, config, wallet_address, api_key_encrypted")
        .eq("user_id", userData.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  const agents = polyarbAgents ?? [];
  const activeAgents = agents.filter((a) => a.status === "RUNNING");
  const totalPortfolio = agents.reduce((sum, a) => sum + (a.starting_capital_usd ?? 0), 0);

  // Determine if PolyArb agent is configured (has wallet + API key)
  const polyarbAgent = agents[0] ?? null;
  const isConfigured = !!(polyarbAgent?.wallet_address && polyarbAgent?.api_key_encrypted);
  const renderedAt = new Date().getTime();
  const heartbeatMs = polyarbAgent?.last_heartbeat_at
    ? renderedAt - new Date(polyarbAgent.last_heartbeat_at).getTime()
    : Infinity;
  const isLive = heartbeatMs < 30_000;

  const stats = [
    { label: "Active Agents", value: activeAgents.length.toString(), color: "#34d399" },
    { label: "Total Portfolio", value: `$${totalPortfolio.toFixed(2)}`, color: "#22d3ee" },
    { label: "PolyArb Status", value: isLive ? "LIVE" : polyarbAgent ? polyarbAgent.status : "NOT SET", color: isLive ? "#34d399" : "#ef4444" },
    { label: "Heartbeat", value: isLive ? `${Math.floor(heartbeatMs / 1000)}s ago` : "—", color: isLive ? "#34d399" : "#475569" },
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* PolyArb Agent card */}
      <div className="mb-4">
        <div className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 px-1">
          Polymarket Agents
        </div>

        <Link
          href="/intelligence/agents/polyarb"
          className="flex items-center justify-between bg-[#0c1829] border border-[#22d3ee]/30 hover:border-[#22d3ee]/70 rounded-lg p-4 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-[#34d399] animate-pulse" : isConfigured ? "bg-yellow-500" : "bg-[#475569]"}`} />
            <div>
              <div className="text-sm font-bold text-[#e2e8f0] font-mono">
                {polyarbAgent?.name ?? "PolyArb Alpha v1"}
              </div>
              <div className="text-xs text-[#475569] mt-0.5 flex items-center gap-2">
                <span>Polymarket crypto markets · Fly.io</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isLive ? "bg-green-900/50 text-green-400" :
                  isConfigured ? "bg-yellow-900/50 text-yellow-400" :
                  "bg-[#1f2937] text-[#475569]"
                }`}>
                  {isLive ? "● LIVE" : isConfigured ? "● STOPPED" : "● NOT CONFIGURED"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isConfigured && (
              <span className="text-xs text-yellow-400 font-mono">Setup needed</span>
            )}
            <ExternalLink size={14} className="text-[#475569] group-hover:text-[#22d3ee] transition-colors" />
          </div>
        </Link>
      </div>

      {/* Future agents placeholder */}
      <div className="mt-6">
        <div className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 px-1">
          Coming Soon
        </div>
        <div className="bg-[#0c1220] border border-dashed border-[#1f2937] rounded-lg p-6 text-center">
          <Zap size={24} className="text-[#1f2937] mx-auto mb-2" />
          <p className="text-xs text-[#334155]">More AI agents coming — Binance, dYdX, Drift</p>
        </div>
      </div>
    </div>
  );
}
