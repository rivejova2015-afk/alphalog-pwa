// src/components/business/panels/KPIPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";
import { loadBusinessCosts } from "@/lib/business/offline-loader";
import {
  calculateKPIMetrics,
  getMonthStr,
  getLastNMonths,
} from "@/lib/business/metrics";
import type { KPIMetrics } from "@/lib/business/metrics";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";
import type { BusinessCost } from "@/lib/business/types";
import type { Trade } from "@/lib/treasury/calculations";
import { usePnlMetrics } from "@/hooks/usePnlMetrics";

interface KPIPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function KPIPanel({ offlineData }: KPIPanelProps) {
  const [costs, setCosts] = useState<BusinessCost[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const { trades, loading: tradesLoading } = usePnlMetrics({
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: false,
  });
  const [currentMonth, setCurrentMonth] = useState<string>(getMonthStr());
  const [kpiMetrics, setKpiMetrics] = useState<KPIMetrics | null>(null);
  const loading = costsLoading || tradesLoading;

  useEffect(() => {
    void loadCosts();
  }, [offlineData]);

  useEffect(() => {
    if (loading) return;
    if (trades.length > 0 || costs.length > 0) {
      const metrics = calculateKPIMetrics(trades as Trade[], costs, currentMonth);
      setKpiMetrics(metrics);
    } else {
      setKpiMetrics(null);
    }
  }, [trades, costs, currentMonth, loading]);

  async function loadCosts() {
    try {
      setCostsLoading(true);
      const costData = (await loadBusinessCosts(offlineData)) as BusinessCost[];
      setCosts(costData || []);
    } catch (err) {
      console.error("Error loading KPI data:", err);
    } finally {
      setCostsLoading(false);
    }
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const accountSorted = kpiMetrics?.accountMetrics
    ? Object.entries(kpiMetrics.accountMetrics)
        .sort(([, a], [, b]) => (b.netProfit ?? 0) - (a.netProfit ?? 0))
    : [];

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <CardTitle className="text-white">Key Performance Indicators</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : (
            <>
              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Month:</label>
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded text-sm"
                >
                  {getLastNMonths(12).map((m) => (
                    <option key={m} value={m}>
                      {new Date(m + "-01").toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </div>

              {kpiMetrics && (
                <>
                  {/* Top-Level KPIs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Cost Per Trade</div>
                      <div className="text-xl font-bold text-white">
                        ${formatNumber(kpiMetrics.costPerTrade)}
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Consistency</div>
                      <div className="text-xl font-bold text-white">
                        {(kpiMetrics.consistency * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {kpiMetrics.uniqueTradeDays} of {kpiMetrics.daysInMonth} days
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Profit Per Hour</div>
                      <div
                        className={`text-xl font-bold ${
                          kpiMetrics.profitPerHour >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        ${formatNumber(Math.abs(kpiMetrics.profitPerHour))}
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Trades</div>
                      <div className="text-xl font-bold text-white">
                        {Object.values(kpiMetrics.accountMetrics).reduce(
                          (sum, acc) => sum + (acc.tradeCount || 0),
                          0
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Per-Account Breakdown */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-4">Per-Account Metrics</h3>
                    {accountSorted.length > 0 ? (
                      <div className="max-w-full overflow-x-auto">
                        <table className="table-mobile-cards w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left text-xs text-slate-400 pb-2">
                                Account
                              </th>
                              <th className="text-right text-xs text-slate-400 pb-2">
                                Trades
                              </th>
                              <th className="text-right text-xs text-slate-400 pb-2">
                                Net Profit
                              </th>
                              <th className="text-right text-xs text-slate-400 pb-2">
                                Cost/Trade
                              </th>
                              <th className="text-right text-xs text-slate-400 pb-2">
                                Profit/Hour
                              </th>
                            </tr>
                          </thead>
                          <tbody className="space-y-1">
                            {accountSorted.map(([accountId, metrics]) => (
                              <tr
                                key={accountId}
                                className="border-b border-slate-700 hover:bg-slate-700/50"
                              >
                                <td data-label="Account" className="py-2 text-slate-200">{accountId}</td>
                                <td data-label="Trades" className="text-right text-slate-200">
                                  {metrics.tradeCount}
                                </td>
                                <td
                                  data-label="Net Profit"
                                  className={`text-right font-semibold ${
                                    (metrics.netProfit ?? 0) >= 0
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  ${formatNumber(Math.abs(metrics.netProfit ?? 0))}
                                </td>
                                <td data-label="Cost/Trade" className="text-right text-slate-200">
                                  ${formatNumber(metrics.costPerTrade)}
                                </td>
                                <td
                                  data-label="Profit/Hour"
                                  className={`text-right ${
                                    (metrics.profitPerHour ?? 0) >= 0
                                      ? "text-green-400"
                                      : "text-red-400"
                                  }`}
                                >
                                  ${formatNumber(Math.abs(metrics.profitPerHour ?? 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400">
                        No account data for this month
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
