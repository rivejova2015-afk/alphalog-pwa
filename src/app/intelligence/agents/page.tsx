import { Bitcoin, Bot, ExternalLink, Zap } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AgentRow {
  id: string;
  name: string;
  status: string;
  starting_capital_usd: number | null;
  last_heartbeat_at: string | null;
  config: Record<string, unknown> | null;
  wallet_address: string | null;
  api_key_encrypted: string | null;
  created_at: string | null;
}

const PAPER_TRADING_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AgentsDashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const [polyarbResult, coinarbResult] = userData?.user
    ? await Promise.all([
        supabase
          .from("polyarb_agents")
          .select("id, name, status, starting_capital_usd, last_heartbeat_at, config, wallet_address, api_key_encrypted, created_at")
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("coinarb_agents")
          .select("id, name, status, starting_capital_usd, last_heartbeat_at, config, wallet_address, api_key_encrypted, created_at")
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const polyAgents = (polyarbResult.data ?? []) as AgentRow[];
  const coinarbAgents = (coinarbResult.data ?? []) as AgentRow[];
  const allAgents = [...polyAgents, ...coinarbAgents];

  const activeAgents = allAgents.filter((a) => a.status === "RUNNING");
  const totalPortfolio = allAgents.reduce((sum, a) => sum + (a.starting_capital_usd ?? 0), 0);

  const polyarbAgent = polyAgents[0] ?? null;
  const isConfigured = !!(polyarbAgent?.wallet_address && polyarbAgent?.api_key_encrypted);
  const renderedAt = new Date().getTime();
  const heartbeatMs = polyarbAgent?.last_heartbeat_at
    ? renderedAt - new Date(polyarbAgent.last_heartbeat_at).getTime()
    : Infinity;
  const isLive = heartbeatMs < 30_000;

  const coinarbAgent = coinarbAgents[0] ?? null;
  const coinarbHbMs = coinarbAgent?.last_heartbeat_at
    ? renderedAt - new Date(coinarbAgent.last_heartbeat_at).getTime()
    : Infinity;
  const coinarbAlive = coinarbHbMs < 30_000;
  const coinarbPaper = coinarbAgent ? (coinarbAgent.config as Record<string, unknown> | null)?.paper_mode !== false : true;
  const coinarbStartedAt = coinarbAgent?.created_at ? new Date(coinarbAgent.created_at).getTime() : null;
  const coinarbDayN = coinarbStartedAt
    ? Math.min(PAPER_TRADING_DAYS, Math.floor((renderedAt - coinarbStartedAt) / DAY_MS) + 1)
    : 0;

  // Coinarb status badge — clearly distinguishes "process alive" from "trading real money"
  const coinarbBadge: { label: string; bgClass: string; textClass: string; dotClass: string } = (() => {
    if (!coinarbAgent) {
      return { label: "● NOT PROVISIONED", bgClass: "bg-[#1f2937]", textClass: "text-[#475569]", dotClass: "bg-[#475569]" };
    }
    if (coinarbPaper && coinarbAlive) {
      return {
        label: `● PAPER · Day ${coinarbDayN}/${PAPER_TRADING_DAYS}`,
        bgClass: "bg-blue-900/40",
        textClass: "text-blue-300",
        dotClass: "bg-blue-400 animate-pulse",
      };
    }
    if (coinarbPaper && !coinarbAlive) {
      return { label: "● PAPER · OFFLINE", bgClass: "bg-yellow-900/40", textClass: "text-yellow-400", dotClass: "bg-yellow-500" };
    }
    if (!coinarbPaper && coinarbAlive) {
      return { label: "● LIVE · REAL $", bgClass: "bg-green-900/50", textClass: "text-green-400", dotClass: "bg-[#34d399] animate-pulse" };
    }
    return { label: `● ${coinarbAgent.status} · OFFLINE`, bgClass: "bg-yellow-900/40", textClass: "text-yellow-400", dotClass: "bg-yellow-500" };
  })();

  const coinarbStatValue = !coinarbAgent
    ? "NOT SET"
    : coinarbPaper
      ? coinarbAlive ? `PAPER ${coinarbDayN}/${PAPER_TRADING_DAYS}` : "PAPER·OFF"
      : coinarbAlive ? "LIVE" : "OFFLINE";
  const coinarbStatColor = !coinarbAgent
    ? "#475569"
    : coinarbPaper && coinarbAlive ? "#60a5fa"
    : !coinarbPaper && coinarbAlive ? "#34d399"
    : "#facc15";

  const stats = [
    { label: "Active Agents", value: activeAgents.length.toString(), color: "#34d399" },
    { label: "Total Portfolio", value: `$${totalPortfolio.toFixed(2)}`, color: "#22d3ee" },
    {
      label: "PolyArb",
      value: isLive ? "LIVE" : polyarbAgent ? polyarbAgent.status : "NOT SET",
      color: isLive ? "#34d399" : polyarbAgent ? "#facc15" : "#475569",
    },
    {
      label: "Coinarb",
      value: coinarbStatValue,
      color: coinarbStatColor,
    },
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

      {/* Coinbase Agents */}
      <div className="mt-6 mb-4">
        <div className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2 px-1">
          Coinbase Agents
        </div>

        <Link
          href="/intelligence/agents/coinarb"
          className="flex items-center justify-between bg-[#0c1829] border border-[#f7931a]/30 hover:border-[#f7931a]/70 rounded-lg p-4 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${coinarbBadge.dotClass}`} />
            <div>
              <div className="text-sm font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
                <Bitcoin size={14} className="text-[#f7931a]" />
                {coinarbAgent?.name ?? "Coinarb 50x"}
              </div>
              <div className="text-xs text-[#475569] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>Coinbase spot + INTX perps · Fly.io</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${coinarbBadge.bgClass} ${coinarbBadge.textClass}`}>
                  {coinarbBadge.label}
                </span>
                {coinarbPaper && coinarbAgent && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0c1220] text-[#475569] border border-[#1f2937]">
                    no real money
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!coinarbAgent && <span className="text-xs text-yellow-400 font-mono">Setup needed</span>}
            <ExternalLink size={14} className="text-[#475569] group-hover:text-[#f7931a] transition-colors" />
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
          <p className="text-xs text-[#334155]">More AI agents coming — Binance, dYdX, Drift, Hyperliquid</p>
        </div>
      </div>
    </div>
  );
}
