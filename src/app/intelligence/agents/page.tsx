import { Bot, Plus } from "lucide-react";
import { AgentsList } from "@/components/intelligence/agents/AgentsList.client";

const PLACEHOLDER_AGENTS = [
  { id: '1', name: 'PolyMarket Alpha', type: 'polymarket' as const, status: 'ACTIVE' as const, portfolioValue: 12500, winRate: 68, roi: 24.5, sharpeRatio: 1.8, maxDrawdown: -8.2, lastTradeTime: '2m ago' },
  { id: '2', name: 'Custom IA Bot v2', type: 'custom_ia' as const, status: 'PAUSED' as const, portfolioValue: 8200, winRate: 54, roi: 12.1, sharpeRatio: 1.2, maxDrawdown: -14.5, lastTradeTime: '1h ago' },
];

export default function AgentsDashboardPage() {
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
        {[
          { label: 'Active Agents', value: '1', color: '#34d399' },
          { label: 'Total Portfolio', value: '$20,700', color: '#22d3ee' },
          { label: 'Avg Win Rate', value: '61%', color: '#34d399' },
          { label: 'Combined ROI', value: '+18.3%', color: '#34d399' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>
      <AgentsList agents={PLACEHOLDER_AGENTS} />
    </div>
  );
}
