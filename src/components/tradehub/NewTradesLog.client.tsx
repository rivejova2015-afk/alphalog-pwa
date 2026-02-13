"use client";

import { useState } from "react";

interface Setup {
  id: string;
  name: string;
}
interface Trade {
  id: string;
  symbol: string;
  direction: string;
  status: string;
  entry_date: string;
  exit_date?: string;
  pnl?: number;
  setup?: Setup;
}

export default function NewTradesLog() {
  const [trades] = useState<Trade[]>([{
    id: "1",
    symbol: "EURUSD",
    direction: "Long",
    status: "Closed",
    entry_date: "2026-02-12",
    exit_date: "2026-02-13",
    pnl: 120.5,
    setup: { id: "s1", name: "Breakout" }
  }]);
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Trades Log</h2>
      <div className="space-y-2">
        {trades.map((trade) => (
          <div
            key={trade.id}
            className="p-4 bg-slate-700/50 border border-slate-600 rounded"
          >
            <div className="font-semibold text-white">
              {trade.symbol} • {trade.direction} • {trade.status}
            </div>
            <div className="text-sm text-slate-300">
              {trade.entry_date}
              {trade.exit_date && ` → ${trade.exit_date}`}
            </div>
            {trade.setup?.name && (
              <div className="text-xs text-slate-400">Setup: {trade.setup.name}</div>
            )}
            {typeof trade.pnl === "number" && (
              <div
                className={`text-sm font-semibold ${
                  trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                P&L: {trade.pnl > 0 ? "+" : ""}{trade.pnl.toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

