"use client";

// Panel que muestra las reglas propfirm activas para una cuenta CME conectada,
// con info evaluada en tiempo real: cutoff vs ahora, próximo evento de noticias,
// max contracts por tier. Sirve para validar visualmente que el enforcement
// del risk-manager está activo antes de operar live.

import { useEffect, useState, useCallback } from "react";
import { Clock, AlertCircle, CheckCircle2, Newspaper, TrendingDown, Hash } from "lucide-react";

interface PropfirmRule {
  overnightCutoffEt?: string;
  newsBlackoutMinutesBefore?: number;
  newsBlackoutMinutesAfter?: number;
  newsBlackoutImpactLevels?: string[];
  trailingDdLockAtProfitDollars?: number;
  maxContractsByTier?: Record<string, number>;
}

interface UpcomingEvent {
  id: string;
  name: string;
  impact: string;
  timestampUtc: string;
}

interface RulesResponse {
  providerName: string | null;
  rule: PropfirmRule | null;
  evaluatedAt: string;
  nowEtHHMM: string;
  pastCutoff: boolean;
  minutesUntilCutoff: number | null;
  upcomingNewsEvents: UpcomingEvent[];
  fundedAmount: number | null;
}

const PROVIDER_BADGES: Record<string, string> = {
  Apex: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Lucid Trading": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  MyFundedFutures: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  Tradeify: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function fmtCountdown(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 0) return `${-minutes}m past`;
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function fmtEventCountdown(iso: string, now: Date): string {
  const ms = new Date(iso).getTime() - now.getTime();
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return `in ${h}h ${rem}m`;
}

export default function CmePropfirmRulesPanel({ cmeAccountId }: { cmeAccountId: string }) {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cme/propfirm-rules?cmeAccountId=${cmeAccountId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [cmeAccountId]);

  useEffect(() => {
    fetchRules();
    const id = setInterval(fetchRules, 60_000); // refresh cada 60s
    return () => clearInterval(id);
  }, [fetchRules]);

  if (loading && !data) {
    return <div className="h-24 rounded-xl bg-white/5 animate-pulse" />;
  }

  if (error) {
    return (
      <div className="px-3 py-2 rounded-md text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
        {error}
      </div>
    );
  }

  if (!data?.providerName || !data.rule) {
    return (
      <div className="px-3 py-3 rounded-md text-xs text-white/40 border border-white/10 bg-white/[0.02]">
        Esta cuenta no tiene reglas propfirm configuradas (provider: {data?.providerName ?? "—"}).
      </div>
    );
  }

  const { providerName, rule, nowEtHHMM, pastCutoff, minutesUntilCutoff, upcomingNewsEvents, fundedAmount } = data;
  const badge = PROVIDER_BADGES[providerName] ?? "bg-white/10 text-white/70 border-white/20";
  const now = new Date();

  let overnightStatus: "ok" | "warn" | "blocked" = "ok";
  if (rule.overnightCutoffEt) {
    if (pastCutoff) overnightStatus = "blocked";
    else if (minutesUntilCutoff != null && minutesUntilCutoff < 30) overnightStatus = "warn";
  }

  // Verifica si algún evento next-24h cae en ventana de blackout (±N min).
  const blackoutBefore = rule.newsBlackoutMinutesBefore ?? 0;
  const eventsInBlackoutSoon = upcomingNewsEvents.filter((e) => {
    const ms = new Date(e.timestampUtc).getTime() - now.getTime();
    return ms <= blackoutBefore * 60_000;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${badge}`}>
          {providerName}
        </span>
        {fundedAmount != null && (
          <span className="text-xs text-white/40">
            ${(fundedAmount / 1000).toFixed(0)}K funded
          </span>
        )}
        <span className="ml-auto text-xs text-white/40">Now ET: {nowEtHHMM}</span>
        <button
          type="button"
          onClick={fetchRules}
          disabled={loading}
          className="px-2 py-0.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white/80"
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Overnight cutoff */}
        <div className={`p-2.5 rounded-md border text-xs ${
          overnightStatus === "blocked" ? "border-rose-500/40 bg-rose-500/5" :
          overnightStatus === "warn" ? "border-amber-500/40 bg-amber-500/5" :
          "border-white/10 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-1.5 text-white/70 mb-1">
            <Clock className="w-3 h-3" />
            <span className="font-medium">Overnight</span>
            {overnightStatus === "ok" && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
            {overnightStatus === "warn" && <AlertCircle className="w-3 h-3 text-amber-400 ml-auto" />}
            {overnightStatus === "blocked" && <AlertCircle className="w-3 h-3 text-rose-400 ml-auto" />}
          </div>
          {rule.overnightCutoffEt ? (
            <div className="text-white/50">
              Flat by <span className="text-white/80 font-mono">{rule.overnightCutoffEt} ET</span>
              {minutesUntilCutoff != null && (
                <span className="ml-1">({fmtCountdown(minutesUntilCutoff)})</span>
              )}
            </div>
          ) : (
            <div className="text-white/40">No cutoff (holds OK)</div>
          )}
        </div>

        {/* News blackout */}
        <div className={`p-2.5 rounded-md border text-xs ${
          eventsInBlackoutSoon.length > 0 ? "border-amber-500/40 bg-amber-500/5" :
          "border-white/10 bg-white/[0.02]"
        }`}>
          <div className="flex items-center gap-1.5 text-white/70 mb-1">
            <Newspaper className="w-3 h-3" />
            <span className="font-medium">News blackout</span>
          </div>
          {rule.newsBlackoutMinutesBefore != null ? (
            <div className="text-white/50">
              Tier 1 ±{rule.newsBlackoutMinutesBefore}/{rule.newsBlackoutMinutesAfter}min
              {upcomingNewsEvents[0] ? (
                <div className="mt-1 text-white/70">
                  Next: <span className="font-mono">{upcomingNewsEvents[0].name}</span>{" "}
                  <span className="text-white/40">{fmtEventCountdown(upcomingNewsEvents[0].timestampUtc, now)}</span>
                </div>
              ) : (
                <div className="mt-1 text-white/40">No events in next 24h</div>
              )}
            </div>
          ) : (
            <div className="text-white/40">No blackout configured</div>
          )}
        </div>

        {/* Trailing DD lock */}
        <div className="p-2.5 rounded-md border border-white/10 bg-white/[0.02] text-xs">
          <div className="flex items-center gap-1.5 text-white/70 mb-1">
            <TrendingDown className="w-3 h-3" />
            <span className="font-medium">Trailing DD lock</span>
          </div>
          {rule.trailingDdLockAtProfitDollars != null ? (
            <div className="text-white/50">
              <span className="text-white/80 font-mono">+${rule.trailingDdLockAtProfitDollars}</span> above funded
            </div>
          ) : (
            <div className="text-white/40">No lock</div>
          )}
        </div>

        {/* Max contracts */}
        <div className="p-2.5 rounded-md border border-white/10 bg-white/[0.02] text-xs">
          <div className="flex items-center gap-1.5 text-white/70 mb-1">
            <Hash className="w-3 h-3" />
            <span className="font-medium">Max contracts</span>
          </div>
          {rule.maxContractsByTier ? (
            <div className="text-white/50 space-y-0.5">
              {Object.entries(rule.maxContractsByTier).map(([tier, limit]) => (
                <div key={tier} className="flex justify-between">
                  <span>${(Number(tier) / 1000).toFixed(0)}K</span>
                  <span className={`font-mono ${
                    fundedAmount != null && String(fundedAmount) === tier ? "text-white" : "text-white/60"
                  }`}>{limit}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-white/40">No tier limit (uses risk_config.max_positions)</div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-white/30 text-right">
        Reglas basadas en research Jun 2026 — verificar T&C oficial antes de operar live
      </div>
    </div>
  );
}
