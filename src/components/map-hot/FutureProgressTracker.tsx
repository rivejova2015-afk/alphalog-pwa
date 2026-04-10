import { Rocket, CheckCircle2, Circle, Clock } from 'lucide-react';

type MilestoneStatus = 'completed' | 'active' | 'upcoming';

interface Milestone {
  id: string;
  label: string;
  target: string;
  status: MilestoneStatus;
  quarter: string;
  description?: string;
}

interface FutureProgressTrackerProps {
  milestones?: Milestone[];
  annualTarget?: string;
  currentProgress?: number;
}

const DEMO_MILESTONES: Milestone[] = [
  { id: '1', label: 'Q1 Foundation', target: '$25,000', status: 'completed', quarter: 'Q1', description: 'Establish GoldRange Basket, reach 65% win rate, set up monitoring' },
  { id: '2', label: 'Q2 Expansion', target: '$30,000', status: 'active', quarter: 'Q2', description: 'Add EUR/USD strategy, reach 68% win rate, deploy ES Futures' },
  { id: '3', label: 'Q3 Optimization', target: '$35,000', status: 'upcoming', quarter: 'Q3', description: 'Optimize all strategies, target 72% win rate, add 4th algo' },
  { id: '4', label: 'Q4 Scale', target: '$30,000', status: 'upcoming', quarter: 'Q4', description: 'Scale lot sizes, reach $120K annual, evaluate new markets' },
];

const STATUS_CONFIG: Record<MilestoneStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: '#34d399', label: 'Complete' },
  active:    { icon: Clock,        color: '#22d3ee', label: 'Active' },
  upcoming:  { icon: Circle,       color: '#475569', label: 'Planned' },
};

export function FutureProgressTracker({
  milestones = DEMO_MILESTONES,
  annualTarget = '$120,000',
  currentProgress = 66.2,
}: FutureProgressTrackerProps) {
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const total = milestones.length;

  return (
    <div className="space-y-6">
      {/* Annual overview */}
      <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Rocket size={18} className="text-[#c084fc]" />
          <h2 className="text-sm font-bold text-[#e2e8f0]">Annual Vision 2025</h2>
        </div>

        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-3xl font-bold font-mono text-[#c084fc]">{annualTarget}</div>
            <div className="text-xs text-[#475569] mt-0.5">Annual revenue target</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-[#e2e8f0]">{currentProgress}%</div>
            <div className="text-xs text-[#475569] mt-0.5">year progress</div>
          </div>
        </div>

        <div className="h-3 bg-[#0a0e1a] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${currentProgress}%`,
              background: 'linear-gradient(90deg, #c084fc, #22d3ee)',
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-[#475569]">
          <span>Jan 2025</span>
          <span className="text-[#c084fc]">{completed}/{total} quarters complete</span>
          <span>Dec 2025</span>
        </div>
      </div>

      {/* Quarterly milestones */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-5 top-6 bottom-6 w-px bg-[#1f2937]" />

        <div className="space-y-4">
          {milestones.map((milestone) => {
            const cfg = STATUS_CONFIG[milestone.status];
            const Icon = cfg.icon;

            return (
              <div key={milestone.id} className="relative flex gap-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-[#0a0e1a] z-10"
                  style={{ borderColor: cfg.color }}
                >
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>

                {/* Content */}
                <div
                  className={`flex-1 bg-[#151b28] border rounded-lg p-4 transition-colors ${
                    milestone.status === 'active'
                      ? 'border-[#22d3ee]/30'
                      : milestone.status === 'completed'
                      ? 'border-[#34d399]/20'
                      : 'border-[#1f2937]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded font-mono"
                          style={{
                            backgroundColor: `${cfg.color}15`,
                            color: cfg.color,
                            border: `1px solid ${cfg.color}30`,
                          }}
                        >
                          {milestone.quarter}
                        </span>
                        <span className="text-sm font-bold text-[#e2e8f0]">{milestone.label}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold font-mono" style={{ color: cfg.color }}>
                      {milestone.target}
                    </span>
                  </div>

                  {milestone.description && (
                    <p className="text-xs text-[#475569] leading-relaxed">{milestone.description}</p>
                  )}

                  <div className="mt-2 text-[10px] font-medium uppercase tracking-wider" style={{ color: cfg.color }}>
                    {cfg.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
