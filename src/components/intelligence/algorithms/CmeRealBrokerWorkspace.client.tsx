'use client';

import { Building2, ArrowRight } from 'lucide-react';

const BROKERS = [
  { name: 'Interactive Brokers (IBKR)', status: 'coming_soon', logo: 'IBKR' },
  { name: 'TradeStation', status: 'coming_soon', logo: 'TS' },
  { name: 'Rithmic', status: 'coming_soon', logo: 'RTH' },
];

export default function CmeRealBrokerWorkspace() {
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
        <div className="flex items-start gap-3">
          <Building2 className="w-5 h-5 text-sky-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-sky-400">Real Broker Integration</p>
            <p className="text-sm text-white/50 mt-1">
              The database infrastructure is ready. Connect your IBKR or TradeStation account
              once you have API credentials configured.
            </p>
            <p className="text-sm text-white/50 mt-1">
              As of 2026-07-13 this also runs on lattice-server&apos;s self-hosted Postgres
              (no longer Supabase) — only the execution engine (broker order routing) is
              still pending, as a separate future sub-project.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {BROKERS.map(broker => (
          <div
            key={broker.name}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 bg-white/5"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white/60 flex-shrink-0">
              {broker.logo}
            </div>
            <span className="text-sm text-white/80 flex-1">{broker.name}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/30 border border-white/10">
              Coming soon
            </span>
            <ArrowRight className="w-4 h-4 text-white/20" />
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-xs text-white/40 leading-relaxed">
          To enable real broker execution: provide your broker API credentials via environment variables
          (<code className="text-white/60">IBKR_CLIENT_ID</code>, <code className="text-white/60">IBKR_CLIENT_SECRET</code>
          for IBKR / <code className="text-white/60">TRADESTATION_API_KEY</code> for TradeStation).
          The execution engine will automatically route signals based on <code className="text-white/60">broker_type</code>.
        </p>
      </div>
    </div>
  );
}
