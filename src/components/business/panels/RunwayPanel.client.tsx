// src/components/business/panels/RunwayPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui";
import { AlertCircle, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { loadBusinessCosts } from "@/lib/business/offline-loader";
import {
  calculatePLMetrics,
  calculateRunwayMetrics,
  getLastNMonths,
} from "@/lib/business/metrics";
import type { RunwayMetrics } from "@/lib/business/metrics";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";
import type { BusinessCost } from "@/lib/business/types";
import type { Trade } from "@/lib/treasury/calculations";
import { usePnlMetrics } from "@/hooks/usePnlMetrics";

import { logError } from "@/lib/log";
interface RunwayPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function RunwayPanel({ offlineData }: RunwayPanelProps) {
  const [costs, setCosts] = useState<BusinessCost[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const { trades, loading: tradesLoading } = usePnlMetrics({
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: false,
  });
  const [cashReserve, setCashReserve] = useState<number>(0);
  const [runwayMetrics, setRunwayMetrics] = useState<RunwayMetrics | null>(null);
  const loading = costsLoading || tradesLoading;

  useEffect(() => {
    void loadCosts();
  }, [offlineData]);

  useEffect(() => {
    if (loading) return;
    if (trades.length > 0 || costs.length > 0) {
      const last3Months = getLastNMonths(3);
      const plMetricsLast3 = last3Months.map((m) =>
        calculatePLMetrics(trades as Trade[], costs, m)
      );
      const runway = calculateRunwayMetrics(plMetricsLast3, cashReserve);
      setRunwayMetrics(runway);
    } else {
      setRunwayMetrics(null);
    }
  }, [trades, costs, cashReserve, loading]);

  async function loadCosts() {
    try {
      setCostsLoading(true);
      const costData = (await loadBusinessCosts(offlineData)) as BusinessCost[];
      setCosts(costData || []);
    } catch (err) {
      logError("RunwayPanel", { component: "runwaypanel", message: "Error loading runway data", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setCostsLoading(false);
    }
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const getRunwayColor = (months: number) => {
    if (months <= 0) return "text-red-400";
    if (months <= 3) return "text-yellow-400";
    return "text-green-400";
  };

  const getRunwayIcon = (months: number) => {
    if (months <= 0) return <AlertCircle className="w-5 h-5 text-red-400" />;
    if (months <= 3) return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
    return <CheckCircle className="w-5 h-5 text-green-400" />;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-white">Runway Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <Skeleton height={56} count={3} />
          ) : (
            <>
              {/* Cash Reserve Input */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                <label className="block text-sm text-slate-400 mb-2">
                  Estimated Cash Reserve ($)
                </label>
                <input
                  type="number"
                  value={cashReserve}
                  onChange={(e) => setCashReserve(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-purple-500"
                  placeholder="0.00"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Enter your liquid cash available to cover monthly operations
                </p>
              </div>

              {runwayMetrics && (
                <>
                  {/* Runway Status Alert */}
                  <div
                    className={`border rounded-lg p-4 ${
                      runwayMetrics.runwayMonths <= 0
                        ? "bg-red-900/20 border-red-800"
                        : runwayMetrics.runwayMonths <= 3
                        ? "bg-yellow-900/20 border-yellow-800"
                        : "bg-green-900/20 border-green-800"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getRunwayIcon(runwayMetrics.runwayMonths)}
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {runwayMetrics.runwayMonths <= 0
                            ? "Critical: No Runway"
                            : runwayMetrics.runwayMonths <= 3
                            ? "Warning: Limited Runway"
                            : "Healthy Runway"}
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          {runwayMetrics.runwayMonths <= 0
                            ? "Your cash reserve is depleted. Immediate action required."
                            : runwayMetrics.runwayMonths <= 3
                            ? "You have less than 3 months of operations covered. Monitor closely."
                            : `You have ${runwayMetrics.runwayMonths.toFixed(1)} months of runway based on current burn rate.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Avg Monthly Profit</div>
                      <div
                        className={`text-xl font-bold ${
                          runwayMetrics.avgMonthlyProfit >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        ${formatNumber(Math.abs(runwayMetrics.avgMonthlyProfit))}
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Avg Monthly Burn</div>
                      <div className="text-xl font-bold text-red-400">
                        ${formatNumber(runwayMetrics.avgMonthlyBurn)}
                      </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-400 mb-1">Cash Reserve</div>
                      <div className="text-xl font-bold text-white">
                        ${formatNumber(runwayMetrics.estimatedCashReserve)}
                      </div>
                    </div>

                    <div className={`bg-slate-800 p-4 rounded-lg border border-slate-700`}>
                      <div className="text-xs text-slate-400 mb-1">Months Runway</div>
                      <div className={`text-xl font-bold ${getRunwayColor(runwayMetrics.runwayMonths)}`}>
                        {runwayMetrics.runwayMonths <= 0
                          ? "Critical"
                          : `${runwayMetrics.runwayMonths.toFixed(1)}m`}
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <h4 className="text-white font-semibold mb-3">How It Works</h4>
                    <div className="space-y-2 text-sm text-slate-300">
                      <div>
                        <span className="text-slate-400">Runway Calculation:</span> Cash Reserve ÷
                        Monthly Burn Rate
                      </div>
                      <div>
                        <span className="text-slate-400">Based on:</span> Last 3 months of trading
                        and operational costs
                      </div>
                      <div>
                        <span className="text-slate-400">Positive Profit:</span> Extends runway;
                        Negative: Depletes faster
                      </div>
                    </div>
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
