// src/components/business/panels/PLPanel.client.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Skeleton } from "@/components/ui";
import { TrendingUp, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { loadBusinessCosts } from "@/lib/business/offline-loader";
import { deleteBusinessCost } from "@/lib/business/queries";
import { calculatePLMetrics, calculateTrendMetrics, getMonthStr, getLastNMonths, type TrendData, type PLMetrics } from "@/lib/business/metrics";
import CostForm from "../forms/CostForm.client";
import type { BusinessCost } from "@/lib/business/types";
import type { BusinessOfflineData } from "@/lib/business/offline-loader";
import type { Trade } from "@/lib/treasury/calculations";
import { usePnlMetrics } from "@/hooks/usePnlMetrics";

import { logError } from "@/lib/log";
interface PLPanelProps {
  offlineData?: BusinessOfflineData | null;
  isReadOnly?: boolean;
}

export default function PLPanel({ offlineData, isReadOnly }: PLPanelProps) {
  const [costs, setCosts] = useState<BusinessCost[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(getMonthStr());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { trades, loading: tradesLoading } = usePnlMetrics({
    closedOnly: true,
    requireExitDate: true,
    ignoreZero: false,
  });
  const [plMetrics, setPlMetrics] = useState<PLMetrics | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const loading = costsLoading || tradesLoading;

  useEffect(() => {
    void loadCosts();
  }, [offlineData]);

  useEffect(() => {
    if (tradesLoading || costsLoading) return;
    if (trades.length > 0 || costs.length > 0) {
      const metrics = calculatePLMetrics(trades as Trade[], costs, currentMonth);
      setPlMetrics(metrics);
      const trend = calculateTrendMetrics(trades as Trade[], costs);
      setTrendData(trend);
    } else {
      setPlMetrics(null);
      setTrendData([]);
    }
  }, [trades, costs, currentMonth, tradesLoading, costsLoading]);

  async function loadCosts() {
    try {
      setCostsLoading(true);
      const costData = (await loadBusinessCosts(offlineData)) as BusinessCost[];
      setCosts(costData || []);
    } catch (err) {
      logError("PLPanel", { component: "plpanel", message: "Error loading P&L data", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setCostsLoading(false);
    }
  }

  async function handleDeleteCost(id: string) {
    try {
      await deleteBusinessCost(id);
      await loadCosts();
      toast.success("Costo eliminado");
    } catch (err) {
      logError("PLPanel", { component: "plpanel", message: "Error deleting cost", error: err instanceof Error ? err.message : String(err) });
      toast.error("No se pudo eliminar el costo");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  const monthCosts = costs.filter((c) => c.cost_date?.startsWith(currentMonth));

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <CardTitle className="text-white">Profit & Loss</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              >
                {getLastNMonths(12).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {!isReadOnly && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Cost
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton height={80} count={1} />
              <div className="grid grid-cols-4 gap-3">
                <Skeleton height={70} /><Skeleton height={70} /><Skeleton height={70} /><Skeleton height={70} />
              </div>
              <Skeleton height={50} count={3} />
            </div>
          ) : plMetrics ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <div className="text-sm text-slate-400">Gross Income</div>
                  <div className="text-2xl font-bold text-green-400">${plMetrics.grossIncome.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <div className="text-sm text-slate-400">Total Costs</div>
                  <div className="text-2xl font-bold text-red-400">${plMetrics.totalCosts.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <div className="text-sm text-slate-400">Net Income</div>
                  <div className={`text-2xl font-bold ${plMetrics.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>${plMetrics.netIncome.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded p-4">
                  <div className="text-sm text-slate-400">Margin</div>
                  <div className="text-2xl font-bold text-blue-400">{plMetrics.margin.toFixed(1)}%</div>
                </div>
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">Costs by Category</h4>
                {Object.keys(plMetrics.costsByCategory).length === 0 ? (
                  <div className="text-slate-400 text-sm py-4">No costs</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(plMetrics.costsByCategory).map(([cat, amt]: [string, any]) => (
                      <div key={cat} className="flex justify-between bg-slate-800 p-3 rounded border border-slate-700">
                        <div className="text-slate-300">{cat}</div>
                        <div className="font-semibold text-white">${amt.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">Income by Account</h4>
                {Object.keys(plMetrics.incomeByAccount).length === 0 ? (
                  <div className="text-slate-400 text-sm py-4">No trades</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(plMetrics.incomeByAccount).map(([acct, inc]: [string, number]) => (
                      <div key={acct} className="flex justify-between bg-slate-800 p-3 rounded border border-slate-700">
                        <div className="text-slate-300">{acct}</div>
                        <div className={`font-semibold ${inc >= 0 ? 'text-green-400' : 'text-red-400'}`}>${inc.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">Monthly Expenses</h4>
                {monthCosts.length === 0 ? (
                  <div className="text-slate-400 text-sm py-4">No costs</div>
                ) : (
                  <div className="space-y-2">
                    {monthCosts.map((cost) => (
                      <div key={cost.id} className="flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700">
                        <div className="flex-1">
                          <div className="text-white font-medium">{cost.vendor}</div>
                          <div className="text-xs text-slate-400">{cost.description}</div>
                        </div>
                        <div className="text-right mr-3">
                          <div className="text-white">${cost.amount.toFixed(2)}</div>
                        </div>
                        <button onClick={() => setConfirmDeleteId(cost.id)} className="p-1 text-red-400" aria-label="Eliminar costo">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-white font-semibold mb-3">6-Month Trend</h4>
                <div className="space-y-2">
                  {trendData.map((data) => (
                    <div key={data.month} className="bg-slate-800 p-3 rounded border border-slate-700">
                      <div className="flex justify-between mb-1">
                        <div className="text-slate-300">{data.month}</div>
                        <div className={`font-semibold ${data.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>${data.profit.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">No data</div>
          )}

          <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-slate-300">Track trading income and costs with monthly metrics.</p>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <CostForm onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); loadCosts(); }} />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Eliminar costo"
        message="Esta acción no se puede deshacer."
        variant="danger"
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId ? handleDeleteCost(confirmDeleteId) : Promise.resolve()}
      />
    </div>
  );
}
