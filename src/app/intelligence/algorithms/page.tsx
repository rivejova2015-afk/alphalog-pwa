import { TrendingUp, Play, Pause, Settings, Plus } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

const PLACEHOLDER_ALGOS = [
  { id: '1', name: 'GoldRange Basket v3', market_type: 'forex', instrument: 'XAU/USD', status: 'ACTIVE', pnl_today: 312.50, win_rate: 71, total_trades: 847 },
  { id: '2', name: 'EUR Trend Follower', market_type: 'forex', instrument: 'EUR/USD', status: 'PAUSED', pnl_today: -45.20, win_rate: 58, total_trades: 234 },
  { id: '3', name: 'ES Futures Mean Rev', market_type: 'futures', instrument: 'ES1!', status: 'ACTIVE', pnl_today: 180.00, win_rate: 64, total_trades: 412 },
];

export default function AlgorithmsPage() {
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

      {/* Algorithm Cards */}
      <div className="space-y-3">
        {PLACEHOLDER_ALGOS.map((algo) => {
          const statusVariant = algo.status === 'ACTIVE' ? 'success' : algo.status === 'ERROR' ? 'error' : 'warning';
          return (
            <div key={algo.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4 hover:border-[#34d399]/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#e2e8f0]">{algo.name}</h3>
                      <Badge variant={statusVariant}>{algo.status}</Badge>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      {algo.market_type.toUpperCase()} · {algo.instrument}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-[#475569]">P&L Today</div>
                    <div className={`text-sm font-bold font-mono ${algo.pnl_today >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                      {algo.pnl_today >= 0 ? '+' : ''}${algo.pnl_today.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-[#475569]">Win Rate</div>
                    <div className="text-sm font-bold font-mono text-[#22d3ee]">{algo.win_rate}%</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-[#475569]">Total Trades</div>
                    <div className="text-sm font-bold font-mono text-[#e2e8f0]">{algo.total_trades.toLocaleString()}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-[#0a0e1a] text-[#94a3b8] rounded transition-colors" aria-label="Toggle strategy">
                      {algo.status === 'ACTIVE' ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button className="p-2 hover:bg-[#0a0e1a] text-[#94a3b8] rounded transition-colors" aria-label="Strategy settings">
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
