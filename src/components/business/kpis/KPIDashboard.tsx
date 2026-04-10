import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPI {
  id: string;
  label: string;
  value: string;
  previousValue: string;
  change: number;
  unit: string;
  category: 'trading' | 'business' | 'personal';
  target?: string;
}

interface KPIDashboardProps {
  kpis?: KPI[];
}

const DEMO_KPIS: KPI[] = [
  { id: '1', label: 'Monthly P&L', value: '$8,450', previousValue: '$6,200', change: 36.3, unit: 'USD', category: 'trading', target: '$10,000' },
  { id: '2', label: 'Win Rate', value: '68.4%', previousValue: '64.1%', change: 6.7, unit: '%', category: 'trading', target: '70%' },
  { id: '3', label: 'Profit Factor', value: '2.14', previousValue: '1.87', change: 14.4, unit: '', category: 'trading', target: '2.0' },
  { id: '4', label: 'Max Drawdown', value: '-6.8%', previousValue: '-9.2%', change: 26.1, unit: '%', category: 'trading', target: '-8%' },
  { id: '5', label: 'Active Strategies', value: '2', previousValue: '1', change: 100, unit: '', category: 'trading', target: '3' },
  { id: '6', label: 'Monthly Expenses', value: '$1,840', previousValue: '$1,920', change: -4.2, unit: 'USD', category: 'business' },
  { id: '7', label: 'Net Revenue', value: '$6,610', previousValue: '$4,280', change: 54.4, unit: 'USD', category: 'business', target: '$8,000' },
  { id: '8', label: 'Runway', value: '14 mo', previousValue: '11 mo', change: 27.3, unit: '', category: 'business', target: '18 mo' },
];

const CATEGORY_LABELS = {
  trading: 'Trading Performance',
  business: 'Business Metrics',
  personal: 'Personal Development',
};

export function KPIDashboard({ kpis = DEMO_KPIS }: KPIDashboardProps) {
  const grouped = kpis.reduce<Record<string, KPI[]>>((acc, kpi) => {
    if (!acc[kpi.category]) acc[kpi.category] = [];
    acc[kpi.category].push(kpi);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {(Object.keys(grouped) as KPI['category'][]).map((category) => (
        <div key={category}>
          <p className="text-xs text-[#475569] uppercase tracking-wider font-medium mb-3">
            {CATEGORY_LABELS[category]}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grouped[category].map((kpi) => {
              const isPositive = kpi.change > 0;
              const isNeutral = kpi.change === 0;
              // For drawdown, lower (less negative) is better
              const isGood = kpi.label.toLowerCase().includes('drawdown') ? !isPositive : isPositive;

              const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
              const trendColor = isNeutral
                ? '#475569'
                : isGood
                ? '#34d399'
                : '#ef4444';

              return (
                <div key={kpi.id} className="bg-[#151b28] border border-[#1f2937] rounded-lg p-4">
                  <div className="text-xs text-[#475569] mb-2">{kpi.label}</div>
                  <div className="text-xl font-bold font-mono text-[#e2e8f0] mb-1">
                    {kpi.value}
                  </div>

                  {/* Change indicator */}
                  <div className="flex items-center gap-1">
                    <TrendIcon size={12} style={{ color: trendColor }} />
                    <span className="text-xs font-mono" style={{ color: trendColor }}>
                      {isPositive ? '+' : ''}{kpi.change.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-[#475569]">vs prev</span>
                  </div>

                  {/* Target */}
                  {kpi.target && (
                    <div className="mt-2 pt-2 border-t border-[#1f2937]">
                      <div className="text-[10px] text-[#475569]">
                        Target: <span className="text-[#94a3b8]">{kpi.target}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
