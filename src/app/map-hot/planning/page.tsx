import { Rocket, Calendar, Target, TrendingUp } from "lucide-react";

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function PlanningPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] font-mono flex items-center gap-2">
            <Rocket size={22} className="text-[#c084fc]" />
            Future Planning
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">Quarterly vision and strategic milestones</p>
        </div>
      </div>

      {/* Year Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {QUARTERS.map((q, i) => (
          <div key={q} className={`bg-[#151b28] border rounded-lg p-4 text-center ${i === 1 ? 'border-[#c084fc]/40' : 'border-[#1f2937]'}`}>
            <div className="text-xs text-[#475569] mb-1">{q} 2025</div>
            <div className={`text-lg font-bold font-mono ${i === 1 ? 'text-[#c084fc]' : 'text-[#94a3b8]'}`}>
              {i === 0 ? '✓ Done' : i === 1 ? 'Active' : 'Planned'}
            </div>
          </div>
        ))}
      </div>

      {/* Strategic Vision */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { icon: Target, label: 'Annual Revenue', value: '$120,000', color: '#34d399' },
          { icon: TrendingUp, label: 'Win Rate Target', value: '75%', color: '#22d3ee' },
          { icon: Calendar, label: 'Milestones', value: '8 planned', color: '#c084fc' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} style={{ color }} />
              <span className="text-xs text-[#94a3b8]">{label}</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Q2 Active Plan */}
      <div className="bg-[#151b28] border border-[#c084fc]/20 rounded-lg p-6">
        <h2 className="text-base font-bold text-[#e2e8f0] mb-4 flex items-center gap-2">
          <span className="text-[#c084fc]">Q2 2025</span> — Active Quarter Plan
        </h2>
        <div className="space-y-3">
          {[
            { label: 'Deploy GoldRange v3 to live accounts', done: true },
            { label: 'Achieve $30K quarterly P&L target', done: false },
            { label: 'Implement EUR/USD algo strategy', done: false },
            { label: 'Reach 70% win rate milestone', done: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded flex items-center justify-center text-xs ${item.done ? 'bg-[#34d399]/20 border border-[#34d399]/40 text-[#34d399]' : 'border border-[#1f2937]'}`}>
                {item.done ? '✓' : ''}
              </div>
              <span className={`text-sm ${item.done ? 'text-[#475569] line-through' : 'text-[#e2e8f0]'}`}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
