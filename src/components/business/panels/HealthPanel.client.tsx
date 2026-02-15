// src/components/business/panels/HealthPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { loadBusinessCosts } from "@/lib/business/offline-loader";
import { calculatePLMetrics, calculateHealthAlerts, getLastNMonths } from "@/lib/business/metrics";
import type { HealthAlert } from "@/lib/business/metrics";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";
import type { BusinessCost } from "@/lib/business/types";
import type { Trade } from "@/lib/treasury/calculations";
import { usePnlMetrics } from "@/hooks/usePnlMetrics";

interface HealthPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function HealthPanel({ offlineData }: HealthPanelProps) {
  const [costs, setCosts] = useState<BusinessCost[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const { trades, loading: tradesLoading } = usePnlMetrics({
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: false,
  });
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const loading = costsLoading || tradesLoading;

  useEffect(() => {
    void loadCosts();
  }, [offlineData]);

  useEffect(() => {
    if (loading) return;
    const last3Months = getLastNMonths(3);
    const plMetricsLast3 = last3Months.map((m) =>
      calculatePLMetrics(trades as Trade[], costs, m)
    );
    const healthAlerts = calculateHealthAlerts(plMetricsLast3, 3, 3);
    setAlerts(healthAlerts);
  }, [trades, costs, loading]);

  async function loadCosts() {
    try {
      setCostsLoading(true);
      const costData = (await loadBusinessCosts(offlineData)) as BusinessCost[];
      setCosts(costData || []);
    } catch (err) {
      console.error("Error loading health data:", err);
    } finally {
      setCostsLoading(false);
    }
  }

  const alertIcons: Record<string, React.ReactNode> = {
    info: <CheckCircle className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
    critical: <AlertCircle className="w-5 h-5 text-red-400" />,
  };

  const alertBgColors: Record<string, string> = {
    info: "bg-blue-900/20 border-blue-800",
    warning: "bg-yellow-900/20 border-yellow-800",
    critical: "bg-red-900/20 border-red-800",
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-white">Health & Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : alerts.length === 0 ? (
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-white font-semibold">All Systems Normal</div>
                  <p className="text-sm text-slate-300">No critical alerts detected.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={`border rounded-lg p-4 ${alertBgColors[alert.severity]}`}>
                  <div className="flex items-start gap-3">
                    {alertIcons[alert.severity]}
                    <div className="flex-1">
                      <div className="text-white font-semibold">{alert.title}</div>
                      <p className="text-sm text-slate-300 mt-1">{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3">Health Check Summary</h4>
            <div className="space-y-2 text-sm text-slate-300">
              <div>• Based on last 3 months performance</div>
              <div>• Negative months flagged for review</div>
              <div>• Runway warnings when &lt; 3 months</div>
              <div>• Critical alerts require action</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
