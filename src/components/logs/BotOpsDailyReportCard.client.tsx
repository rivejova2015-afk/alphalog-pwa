"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ProfileSnapshot = {
  id: string;
  createdAt: string;
  generatedAt: string;
  overallStatus: string;
  sloSummary?: {
    status?: string | null;
    severity?: string | null;
  } | null;
} | null;

type BotDailyReportResponse = {
  ok: boolean;
  latest: {
    id: string;
    createdAt: string;
    generatedAt: string;
    overallStatus: string;
    marketPolicy: string | null;
  } | null;
  byProfile: {
    forex: ProfileSnapshot;
    futuros: ProfileSnapshot;
  };
  recommendations: string[];
};

type HistoryPoint = {
  date: string;
  generatedAt: string;
  forex: "PASS" | "DEGRADED" | "FAIL" | "UNKNOWN";
  futuros: "PASS" | "DEGRADED" | "FAIL" | "UNKNOWN";
  overall: "PASS" | "DEGRADED" | "FAIL" | "UNKNOWN";
};

type HistoryResponse = {
  ok: boolean;
  days: number;
  points: HistoryPoint[];
  totals: {
    PASS: number;
    DEGRADED: number;
    FAIL: number;
    UNKNOWN: number;
  };
};

function statusStyles(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "FAIL") return "bg-rose-600/20 text-rose-200 border-rose-500/40";
  if (normalized === "DEGRADED") return "bg-amber-600/20 text-amber-200 border-amber-500/40";
  if (normalized === "PASS") return "bg-emerald-600/20 text-emerald-200 border-emerald-500/40";
  return "bg-slate-700/60 text-slate-200 border-slate-600/60";
}

export default function BotOpsDailyReportCard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BotDailyReportResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ops/bot-daily-report", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as BotDailyReportResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error((payload as { error?: string } | null)?.error || "Failed to load daily report");
      }
      setData(payload);

      const historyResponse = await fetch("/api/ops/bot-daily-report/history?days=30", {
        method: "GET",
        cache: "no-store",
      });
      const historyPayload = (await historyResponse.json().catch(() => null)) as HistoryResponse | null;
      if (!historyResponse.ok || !historyPayload?.ok) {
        throw new Error(
          (historyPayload as { error?: string } | null)?.error || "Failed to load daily history"
        );
      }
      setHistory(historyPayload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load daily report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const latestStatusClass = useMemo(
    () => statusStyles(data?.latest?.overallStatus || "UNKNOWN"),
    [data?.latest?.overallStatus]
  );

  if (loading) {
    return (
      <div className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/70">
        <p className="text-sm text-slate-400">Loading bot daily verification...</p>
      </div>
    );
  }

  return (
    <div className="border border-slate-700/60 rounded-2xl p-4 bg-slate-900/70 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Bot Ops Daily Verification</h3>
          <p className="text-xs text-slate-400">
            Latest consolidated health + SLO report persisted by ops automation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-600/70 text-slate-200 hover:bg-slate-800/70 transition"
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-600/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!data?.latest && !error && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
          No daily verification events yet. Run `npm run ops:bot-daily-verify`.
        </div>
      )}

      {data?.latest && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs border ${latestStatusClass}`}>
              {data.latest.overallStatus}
            </span>
            <span className="text-xs text-slate-400">
              Generated: {new Date(data.latest.generatedAt).toLocaleString()}
            </span>
            {data.latest.marketPolicy && (
              <span className="text-xs text-slate-400">Policy: {data.latest.marketPolicy}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["forex", "futuros"] as const).map((profile) => {
              const entry = data.byProfile?.[profile];
              if (!entry) {
                return (
                  <div key={profile} className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-200 capitalize">{profile}</p>
                    <p className="text-xs text-slate-400 mt-1">No snapshot available.</p>
                  </div>
                );
              }
              const pillClass = statusStyles(entry.overallStatus);
              return (
                <div key={profile} className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 space-y-1">
                  <p className="text-sm font-semibold text-slate-200 capitalize">{profile}</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs border ${pillClass}`}>
                    {entry.overallStatus}
                  </span>
                  <p className="text-xs text-slate-400">
                    SLO: {entry.sloSummary?.status || "n/a"} / {entry.sloSummary?.severity || "n/a"}
                  </p>
                </div>
              );
            })}
          </div>

          {data.recommendations?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-200">Recommended actions</p>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {data.recommendations.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {history && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-slate-200">
                  History ({history.days} days)
                </p>
                <span className="text-xs text-slate-400">PASS: {history.totals.PASS}</span>
                <span className="text-xs text-slate-400">DEGRADED: {history.totals.DEGRADED}</span>
                <span className="text-xs text-slate-400">FAIL: {history.totals.FAIL}</span>
              </div>

              <div className="border border-slate-700/60 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800/70 text-slate-300">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Overall</th>
                      <th className="text-left px-3 py-2 font-medium">Forex</th>
                      <th className="text-left px-3 py-2 font-medium">Futuros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.points.slice(0, 7).map((point) => (
                      <tr key={point.date} className="border-t border-slate-700/50">
                        <td className="px-3 py-2 text-slate-200">
                          {new Date(point.generatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full border ${statusStyles(point.overall)}`}>
                            {point.overall}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full border ${statusStyles(point.forex)}`}>
                            {point.forex}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 rounded-full border ${statusStyles(point.futuros)}`}>
                            {point.futuros}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
