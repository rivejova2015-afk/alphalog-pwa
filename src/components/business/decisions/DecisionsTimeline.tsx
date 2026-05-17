import { formatDate } from '@/utils/formatters';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface DecisionTask {
  id: string;
  title: string;
  done: boolean;
}

interface Decision {
  id: string;
  decision_text: string;
  expected_impact: string;
  status: 'ACTIVE' | 'COMPLETED' | 'PENDING';
  linked_algos: string[] | null;
  created_at: string;
  tasks?: DecisionTask[];
}

interface DecisionsTimelineProps {
  decisions?: Decision[];
}

const DEMO_DECISIONS: Decision[] = [
  {
    id: '1',
    decision_text: 'Increase GoldRange Basket lot size from 0.3 to 0.5 after consistent monthly P&L',
    expected_impact: 'Estimated +40% monthly revenue with controlled drawdown',
    status: 'ACTIVE',
    linked_algos: ['GoldRange Basket v3'],
    created_at: '2025-04-01T10:00:00Z',
    tasks: [
      { id: 't1', title: 'Monitor drawdown for 2 weeks at 0.4 lots', done: true },
      { id: 't2', title: 'Set SL to 50 pips maximum', done: true },
      { id: 't3', title: 'Scale to 0.5 lots by April 15', done: false },
    ],
  },
  {
    id: '2',
    decision_text: 'Add EUR/USD strategy to diversify from gold-only exposure',
    expected_impact: 'Reduces correlation risk; adds ~$500/month revenue stream',
    status: 'PENDING',
    linked_algos: ['EUR Trend Follower'],
    created_at: '2025-03-20T14:30:00Z',
    tasks: [
      { id: 't4', title: 'Backtest EUR/USD strategy on 2 years data', done: true },
      { id: 't5', title: 'Paper trade for 1 month', done: false },
      { id: 't6', title: 'Deploy with 0.1 lots initial', done: false },
    ],
  },
  {
    id: '3',
    decision_text: 'Automate monthly P&L report generation via Intelligence terminal',
    expected_impact: 'Save 4 hours/month; consistent reporting format for tracking',
    status: 'COMPLETED',
    linked_algos: null,
    created_at: '2025-03-01T09:00:00Z',
    tasks: [
      { id: 't7', title: 'Set up QStash scheduled jobs', done: true },
      { id: 't8', title: 'Connect OpenAI for report generation', done: true },
      { id: 't9', title: 'Test and validate output format', done: true },
    ],
  },
];

const STATUS_CONFIG = {
  ACTIVE:    { variant: 'running' as const, icon: CheckCircle2, color: '#34d399' },
  COMPLETED: { variant: 'default' as const, icon: CheckCircle2, color: '#22d3ee' },
  PENDING:   { variant: 'warning' as const, icon: Clock,        color: '#eab308' },
};

export function DecisionsTimeline({ decisions = DEMO_DECISIONS }: DecisionsTimelineProps) {
  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-4 top-8 bottom-8 w-px bg-[#1f2937]" />

      {decisions.map((decision, idx) => {
        const cfg = STATUS_CONFIG[decision.status];
        const StatusIcon = cfg.icon;
        const doneTasks = decision.tasks?.filter((t) => t.done).length ?? 0;
        const totalTasks = decision.tasks?.length ?? 0;

        return (
          <div key={decision.id} className="relative pl-12 pb-8">
            {/* Timeline dot */}
            <div
              className="absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 bg-[#0a0e1a]"
              style={{ borderColor: cfg.color }}
            >
              <StatusIcon size={14} style={{ color: cfg.color }} />
            </div>

            {/* Card */}
            <div className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-[#e2e8f0] leading-snug flex-1">
                  {decision.decision_text}
                </p>
                <Badge variant={cfg.variant}>{decision.status}</Badge>
              </div>

              <p className="text-xs text-[#94a3b8] mb-3 italic">
                Impact: {decision.expected_impact}
              </p>

              {/* Linked algos */}
              {decision.linked_algos && decision.linked_algos.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {decision.linked_algos.map((algo) => (
                    <span
                      key={algo}
                      className="text-[10px] px-2 py-0.5 bg-[#22d3ee]/10 border border-[#22d3ee]/20 text-[#22d3ee] rounded"
                    >
                      {algo}
                    </span>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {decision.tasks && decision.tasks.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#475569] uppercase tracking-wider">
                      Tasks
                    </span>
                    <span className="text-[10px] text-[#475569] font-mono">
                      {doneTasks}/{totalTasks}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 bg-[#0a0e1a] rounded overflow-hidden mb-2">
                    <div
                      className="h-full bg-[#34d399] rounded transition-all"
                      style={{ width: totalTasks > 0 ? `${(doneTasks / totalTasks) * 100}%` : '0%' }}
                    />
                  </div>
                  {decision.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0 ${
                          task.done
                            ? 'bg-[#34d399]/20 border border-[#34d399]/40 text-[#34d399]'
                            : 'border border-[#1f2937]'
                        }`}
                      >
                        {task.done ? '✓' : ''}
                      </div>
                      <span
                        className={`text-xs ${
                          task.done ? 'text-[#475569] line-through' : 'text-[#94a3b8]'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-[10px] text-[#475569] pt-2 border-t border-[#1f2937]">
                {formatDate(decision.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
