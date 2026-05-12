'use client';

type MarketType = 'forex' | 'futures' | 'options' | 'crypto';

interface Props {
  marketType: MarketType;
  algoId: string;
  parameters?: Record<string, unknown>;
}

interface ModelCard {
  title: string;
  subtitle: string;
  fields: { label: string; value: string; accent?: boolean }[];
  badge?: string;
}

function deriveModels(marketType: MarketType, params: Record<string, unknown>): ModelCard[] {
  // Seed deterministic-looking values from algoId chars — replaced by engine realtime later
  const seed = (params?.seed as number) ?? 42;
  const winRate = (params?.win_rate as number) ?? 0.62;
  const edge = (params?.edge as number) ?? 0.08;

  const ou: ModelCard = {
    title: 'Ornstein-Uhlenbeck',
    subtitle: 'Mean Reversion',
    badge: 'UNIVERSAL',
    fields: [
      { label: 'Z-score', value: ((seed % 300) / 100 - 1.5).toFixed(3), accent: true },
      { label: 'Half-life', value: `${((seed % 20) + 5)} min` },
      { label: 'θ (rev. speed)', value: ((seed % 40 + 10) / 100).toFixed(4) },
      { label: 'σ (volatility)', value: ((seed % 15 + 8) / 1000).toFixed(5) },
    ],
  };

  const hmm: ModelCard = {
    title: 'HMM Regime',
    subtitle: 'Hidden Markov Model',
    badge: 'UNIVERSAL',
    fields: [
      { label: 'Regime', value: ['SIDEWAYS', 'BULL', 'BEAR', 'BREAKOUT'][seed % 4], accent: true },
      { label: 'Probability', value: `${((seed % 25) + 70)}%` },
      { label: 'States', value: '4 (S/B/Br/E)' },
      { label: 'Transitions', value: `${(seed % 8) + 3} last hour` },
    ],
  };

  const kelly: ModelCard = {
    title: 'Kelly Criterion',
    subtitle: 'Position Sizing',
    badge: 'UNIVERSAL',
    fields: [
      { label: 'Kelly fraction', value: `${(edge / (1 - winRate + edge + 0.001) * 100).toFixed(2)}%`, accent: true },
      { label: 'Win rate', value: `${(winRate * 100).toFixed(1)}%` },
      { label: 'Edge (b)', value: edge.toFixed(4) },
      { label: 'Rec. size', value: `$${Math.round(edge / 0.001 * 10)}` },
    ],
  };

  const entropy: ModelCard = {
    title: 'Shannon Entropy',
    subtitle: 'Signal Quality',
    badge: 'UNIVERSAL',
    fields: [
      { label: 'H (entropy)', value: `${((seed % 35) + 40)}%`, accent: true },
      { label: 'Signal quality', value: (seed % 35) + 40 < 60 ? 'GOOD' : 'NOISY' },
      { label: 'Bits/symbol', value: ((seed % 6) / 10 + 0.7).toFixed(3) },
      { label: 'Max entropy', value: '100%' },
    ],
  };

  const universal = [ou, hmm, kelly, entropy];

  if (marketType === 'futures') {
    return [
      ...universal,
      {
        title: 'Lévy Tail Risk',
        subtitle: 'Fat Tail Distribution',
        badge: 'FUTURES',
        fields: [
          { label: 'α (tail index)', value: ((seed % 30) / 100 + 1.4).toFixed(3), accent: true },
          { label: 'Fat tails', value: (seed % 30) / 100 + 1.4 < 2 ? 'YES (α<2)' : 'LIGHT' },
          { label: 'P(3σ move)', value: `${((seed % 8) + 2).toFixed(1)}%` },
          { label: 'Scale γ', value: ((seed % 20) / 1000 + 0.005).toFixed(5) },
        ],
      },
      {
        title: 'Kalman Filter',
        subtitle: 'Dynamic Hedge Ratio',
        badge: 'FUTURES',
        fields: [
          { label: 'β (hedge ratio)', value: ((seed % 40) / 100 + 0.8).toFixed(4), accent: true },
          { label: 'Filter var.', value: ((seed % 10) / 10000 + 0.0001).toFixed(6) },
          { label: 'Process noise', value: ((seed % 5) / 100000).toFixed(7) },
          { label: 'Kalman gain', value: ((seed % 30) / 1000 + 0.01).toFixed(4) },
        ],
      },
    ];
  }

  if (marketType === 'options') {
    return [
      ...universal,
      {
        title: 'Black-Scholes',
        subtitle: 'Theoretical Pricing',
        badge: 'OPTIONS',
        fields: [
          { label: 'Theo. price', value: `$${((seed % 50) + 10).toFixed(2)}`, accent: true },
          { label: 'IV implied', value: `${((seed % 25) + 18).toFixed(1)}%` },
          { label: 'Dist. to ATM', value: `${((seed % 15) - 7).toFixed(2)}%` },
          { label: 'd1 / d2', value: `${((seed % 40) / 100 - 0.2).toFixed(3)} / ${((seed % 30) / 100 - 0.3).toFixed(3)}` },
        ],
      },
      {
        title: 'Heston Model',
        subtitle: 'Stochastic Volatility',
        badge: 'OPTIONS',
        fields: [
          { label: 'Vol of vol (ν)', value: ((seed % 30) / 100 + 0.1).toFixed(4), accent: true },
          { label: 'Mean rev. (κ)', value: ((seed % 5) + 1).toFixed(2) },
          { label: 'Correlation (ρ)', value: `${-(seed % 60) / 100 - 0.3}`.slice(0, 6) },
          { label: 'Long-run var.', value: ((seed % 8) / 100 + 0.02).toFixed(4) },
        ],
      },
      {
        title: 'Greeks Live',
        subtitle: 'Risk Sensitivities',
        badge: 'OPTIONS',
        fields: [
          { label: 'Δ Delta', value: ((seed % 60) / 100 + 0.15).toFixed(4), accent: true },
          { label: 'Γ Gamma', value: ((seed % 8) / 1000 + 0.001).toFixed(5) },
          { label: 'Θ Theta/day', value: `-$${((seed % 20) + 5).toFixed(2)}` },
          { label: 'Vega /1%IV', value: `$${((seed % 40) + 15).toFixed(2)}` },
        ],
      },
    ];
  }

  return universal;
}

const BADGE_COLORS: Record<string, string> = {
  UNIVERSAL: '#475569',
  FUTURES:   '#f59e0b',
  OPTIONS:   '#a78bfa',
};

export function QuantModelsPanel({ marketType, algoId, parameters = {} }: Props) {
  const seed = algoId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const models = deriveModels(marketType, { ...parameters, seed });

  return (
    <div className="mt-4 border-t border-[#1f2937] pt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-[#22d3ee] uppercase tracking-wider font-mono font-bold">Quant Models</span>
        <span className="text-[10px] text-[#2d3748]">— engine state (placeholder until realtime connected)</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((m) => (
          <div key={m.title} className="rounded-lg border border-[#1f2937] bg-[#0a0e1a] p-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[11px] font-bold text-[#e2e8f0] font-mono leading-tight">{m.title}</p>
                <p className="text-[9px] text-[#475569] mt-0.5">{m.subtitle}</p>
              </div>
              {m.badge && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                  color: BADGE_COLORS[m.badge] ?? '#475569',
                  border: `1px solid ${BADGE_COLORS[m.badge] ?? '#475569'}40`,
                  background: `${BADGE_COLORS[m.badge] ?? '#475569'}10`,
                }}>
                  {m.badge}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {m.fields.map((f) => (
                <div key={f.label} className="flex items-center justify-between">
                  <span className="text-[9px] text-[#475569]">{f.label}</span>
                  <span className={`text-[10px] font-mono font-bold ${f.accent ? 'text-[#22d3ee]' : 'text-[#94a3b8]'}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
