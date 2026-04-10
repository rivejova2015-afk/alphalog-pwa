import { TrendingUp, Plus } from "lucide-react";
import { AlgoAccordion } from "@/components/intelligence/algorithms/AlgoAccordion.client";

const ALGOS = [
  { id: '1', name: 'GoldRange Basket v3', marketType: 'forex' as const, instrument: 'XAU/USD', status: 'ACTIVE' as const, pnlToday: 312.50, pnlTotal: 18450, winRate: 71, totalTrades: 847, profitFactor: 2.14, maxDrawdown: -6.8 },
  { id: '2', name: 'EUR Trend Follower', marketType: 'forex' as const, instrument: 'EUR/USD', status: 'PAUSED' as const, pnlToday: -45.20, pnlTotal: 5200, winRate: 58, totalTrades: 234, profitFactor: 1.42, maxDrawdown: -12.3 },
  { id: '3', name: 'ES Futures Mean Rev', marketType: 'futures' as const, instrument: 'ES1!', status: 'ACTIVE' as const, pnlToday: 180.00, pnlTotal: 9800, winRate: 64, totalTrades: 412, profitFactor: 1.87, maxDrawdown: -8.5 },
];

export default function AlgorithmsPage() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <TrendingUp size={22} className="text-[#34d399]" />
            Algorithmic Trading
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Forex and futures algorithm strategies</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-[#34d399] hover:bg-[#2ba88b] text-[#0a0e1a] text-sm font-bold rounded transition-colors">
          <Plus size={16} />
          New Strategy
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Strategies', value: '2', color: '#34d399' },
          { label: "P&L Today", value: '+$447.30', color: '#34d399' },
          { label: 'Avg Win Rate', value: '64.3%', color: '#22d3ee' },
          { label: 'Total Trades', value: '1,493', color: '#94a3b8' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-3">
            <div className="text-xs text-[#475569] mb-1">{stat.label}</div>
            <div className="text-lg font-bold font-mono" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Accordion with full detail */}
      <AlgoAccordion algos={ALGOS} />
    </div>
  );
}
