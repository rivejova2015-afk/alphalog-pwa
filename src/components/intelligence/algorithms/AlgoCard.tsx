import { Badge } from '@/components/shared/Badge';

type MarketType = 'forex' | 'futures' | 'options';
type Direction  = 'long' | 'short' | 'both';

interface AlgoCardProps {
  id: string;
  name: string;
  marketType: MarketType;
  instrument: string;
  direction?: Direction;
  parameters?: Record<string, unknown>;
  status: 'ACTIVE' | 'PAUSED' | 'ERROR';
  pnlToday: number;
  pnlTotal: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  onClick?: () => void;
}

const MARKET_STYLE: Record<MarketType, { label: string; color: string }> = {
  forex:   { label: 'Forex/MT',  color: '#34d399' },
  futures: { label: 'Futures',   color: '#f59e0b' },
  options: { label: 'Options',   color: '#a78bfa' },
};

const DIRECTION_LABEL: Record<Direction, string> = {
  long:  'Long bias',
  short: 'Short bias',
  both:  'Both',
};

export function AlgoCard({
  name,
  marketType,
  instrument,
  direction = 'both',
  parameters = {},
  status,
  pnlToday,
  pnlTotal,
  winRate,
  totalTrades,
  profitFactor,
  maxDrawdown,
  onClick,
}: AlgoCardProps) {
  const statusVariant =
    status === 'ACTIVE' ? 'success' : status === 'ERROR' ? 'error' : 'warning';

  const mStyle = MARKET_STYLE[marketType];

  const legB = parameters?.leg_b_instrument;
  const subLine = marketType === 'futures'
    ? `${instrument} · ${DIRECTION_LABEL[direction]}`
    : marketType === 'options'
    ? `${instrument} · ${String(parameters?.options_strategy ?? '').replace(/_/g, ' ')} · ${DIRECTION_LABEL[direction]}`
    : legB
    ? `${instrument} → ${String(legB)} · ${DIRECTION_LABEL[direction]}`
    : `${instrument} · ${DIRECTION_LABEL[direction]}`;

  return (
    <div
      className={`bg-[#151b28] border rounded-lg p-4 transition-colors ${
        onClick
          ? 'cursor-pointer hover:border-[#34d399]/40'
          : 'border-[#1f2937]'
      } ${status === 'ACTIVE' ? 'border-[#34d399]/20' : 'border-[#1f2937]'}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#e2e8f0] truncate">{name}</h3>
          <p className="text-xs text-[#475569] mt-0.5 truncate capitalize">{subLine}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold"
            style={{ color: mStyle.color, background: `${mStyle.color}15`, border: `1px solid ${mStyle.color}30` }}>
            {mStyle.label}
          </span>
          <Badge variant={statusVariant}>{status}</Badge>
        </div>
      </div>

      {/* P&L Today — prominent */}
      <div className="mb-4 p-3 bg-[#0a0e1a] rounded-lg">
        <div className="text-xs text-[#475569] mb-1">P&L Today</div>
        <div
          className={`text-2xl font-bold font-mono ${
            pnlToday >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'
          }`}
        >
          {pnlToday >= 0 ? '+' : ''}${pnlToday.toFixed(2)}
        </div>
        <div className="text-xs text-[#475569] mt-0.5">
          Total: {pnlTotal >= 0 ? '+' : ''}${pnlTotal.toLocaleString()}
        </div>
      </div>

      {/* Metrics 3-col */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-[#475569] mb-1">Win Rate</div>
          <div className="text-[#22d3ee] font-mono font-bold">{winRate}%</div>
        </div>
        <div>
          <div className="text-[#475569] mb-1">Trades</div>
          <div className="text-[#e2e8f0] font-mono font-bold">{totalTrades.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[#475569] mb-1">Profit F.</div>
          <div className={`font-mono font-bold ${profitFactor >= 1.5 ? 'text-[#34d399]' : profitFactor >= 1 ? 'text-[#eab308]' : 'text-[#ef4444]'}`}>
            {profitFactor.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Drawdown bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[#475569]">Max Drawdown</span>
          <span className="text-[#ef4444] font-mono">{maxDrawdown}%</span>
        </div>
        <div className="h-1.5 bg-[#0a0e1a] rounded overflow-hidden">
          <div
            className="h-full bg-[#ef4444]/60 rounded"
            style={{ width: `${Math.min(Math.abs(maxDrawdown), 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
