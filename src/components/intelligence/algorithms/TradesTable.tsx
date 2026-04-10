import { formatDate, formatDuration } from '@/utils/formatters';

interface Trade {
  id: string;
  trade_number: number;
  direction: 'BUY' | 'SELL';
  instrument: string;
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  lot_size: number;
  pnl: number;
  duration_seconds: number;
}

interface TradesTableProps {
  trades: Trade[];
  maxRows?: number;
}

const DEMO_TRADES: Trade[] = [
  { id: '1', trade_number: 847, direction: 'BUY', instrument: 'XAU/USD', entry_price: 2334.50, exit_price: 2341.20, entry_time: '2025-04-08T08:15:00Z', exit_time: '2025-04-08T09:42:00Z', lot_size: 0.5, pnl: 335.00, duration_seconds: 5220 },
  { id: '2', trade_number: 846, direction: 'SELL', instrument: 'XAU/USD', entry_price: 2340.10, exit_price: 2336.80, entry_time: '2025-04-08T06:30:00Z', exit_time: '2025-04-08T07:55:00Z', lot_size: 0.3, pnl: 99.00, duration_seconds: 5100 },
  { id: '3', trade_number: 845, direction: 'BUY', instrument: 'XAU/USD', entry_price: 2328.90, exit_price: 2325.40, entry_time: '2025-04-07T14:20:00Z', exit_time: '2025-04-07T16:10:00Z', lot_size: 0.5, pnl: -175.00, duration_seconds: 6600 },
  { id: '4', trade_number: 844, direction: 'BUY', instrument: 'XAU/USD', entry_price: 2320.00, exit_price: 2331.50, entry_time: '2025-04-07T10:00:00Z', exit_time: '2025-04-07T12:45:00Z', lot_size: 0.4, pnl: 460.00, duration_seconds: 9900 },
  { id: '5', trade_number: 843, direction: 'SELL', instrument: 'XAU/USD', entry_price: 2315.20, exit_price: 2312.80, entry_time: '2025-04-07T07:30:00Z', exit_time: '2025-04-07T09:00:00Z', lot_size: 0.5, pnl: 120.00, duration_seconds: 5400 },
];

export function TradesTable({ trades = DEMO_TRADES, maxRows = 10 }: TradesTableProps) {
  const visible = trades.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1f2937]">
            {['#', 'Dir', 'Instrument', 'Entry', 'Exit', 'Lots', 'Duration', 'P&L'].map((h) => (
              <th key={h} className="py-2 px-3 text-left text-[#475569] font-medium uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((trade) => (
            <tr key={trade.id} className="border-b border-[#1f2937]/40 hover:bg-[#151b28]/50 transition-colors">
              <td className="py-2.5 px-3 text-[#475569] font-mono">{trade.trade_number}</td>
              <td className="py-2.5 px-3">
                <span className={`font-bold font-mono ${trade.direction === 'BUY' ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                  {trade.direction}
                </span>
              </td>
              <td className="py-2.5 px-3 text-[#e2e8f0] font-mono">{trade.instrument}</td>
              <td className="py-2.5 px-3 text-[#94a3b8] font-mono">{trade.entry_price.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-[#94a3b8] font-mono">{trade.exit_price.toFixed(2)}</td>
              <td className="py-2.5 px-3 text-[#94a3b8] font-mono">{trade.lot_size}</td>
              <td className="py-2.5 px-3 text-[#475569]">{formatDuration(trade.duration_seconds)}</td>
              <td className="py-2.5 px-3">
                <span className={`font-mono font-bold ${trade.pnl >= 0 ? 'text-[#34d399]' : 'text-[#ef4444]'}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {trades.length > maxRows && (
        <div className="text-center py-3 text-xs text-[#475569]">
          Showing {maxRows} of {trades.length} trades
        </div>
      )}
    </div>
  );
}
