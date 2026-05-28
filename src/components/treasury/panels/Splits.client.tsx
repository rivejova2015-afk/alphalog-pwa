"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Account, TreasuryConfig } from "@/lib/treasury/calculations";
import {
  calculateRetirable,
  getSplitPercentage,
  formatCurrency,
} from "@/lib/treasury/calculations";

interface SplitsPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  onConfigsChange?: (configs: TreasuryConfig[]) => void;
  isReadOnly?: boolean;
}

type SplitMode = "growth" | "safe" | "cash";

const splitModes: Array<{ value: SplitMode; label: string; percentage: number; description: string }> = [
  { value: "growth", label: "📈 Growth", percentage: 50, description: "Aggressive growth" },
  { value: "safe", label: "⚖️ Safe", percentage: 40, description: "Balanced approach" },
  { value: "cash", label: "💰 Cash", percentage: 100, description: "All profits retirable" },
];

export default function SplitsPanel({
  accounts,
  configs,
  onConfigsChange,
  isReadOnly,
}: SplitsPanelProps) {
  const [localConfigs, setLocalConfigs] = useState<TreasuryConfig[]>(configs);
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);

  const configMap = new Map(localConfigs.map((c) => [c.account_id, c]));

  const persistSplitMode = async (accountId: string, nextMode: SplitMode) => {
    setSavingAccountId(accountId);
    try {
      const res = await fetch("/api/treasury/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, split_mode: nextMode }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el split mode");
        return;
      }
      const { config } = (await res.json()) as { config: TreasuryConfig };
      const next = localConfigs.some((c) => c.account_id === accountId)
        ? localConfigs.map((c) => (c.account_id === accountId ? config : c))
        : [...localConfigs, config];
      setLocalConfigs(next);
      onConfigsChange?.(next);
      toast.success(`Split mode actualizado a ${nextMode}`);
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingAccountId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Split Mode Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {splitModes.map((mode) => (
          <Card key={mode.value} className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">{mode.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-400">{mode.percentage}%</p>
              <p className="text-xs text-slate-400 mt-2">{mode.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account Split Selection */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Account Split Modes</h3>
        {accounts.map((account) => {
          const config = configMap.get(account.id);
          const splitMode = (config?.split_mode ?? "safe") as SplitMode;
          const splitPercentage = getSplitPercentage(splitMode);
          const retirable = calculateRetirable(account, config);
          const isSaving = savingAccountId === account.id;

          return (
            <Card key={account.id} className="bg-slate-900 border-slate-800">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium mb-2">{account.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600">
                        {splitModes.find((m) => m.value === splitMode)?.label}
                      </Badge>
                      <span className="text-sm text-slate-400">
                        {splitPercentage}% of profits retirable
                      </span>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`split-${account.id}`} className="sr-only">
                        Split mode for {account.name}
                      </label>
                      <select
                        id={`split-${account.id}`}
                        value={splitMode}
                        disabled={isSaving}
                        onChange={(e) => void persistSplitMode(account.id, e.target.value as SplitMode)}
                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-sm text-white disabled:opacity-50"
                      >
                        {splitModes.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label} ({m.percentage}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(retirable)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Retirable</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Split mode determines what % of profit can be withdrawn as retirable.
          Remaining profit stays in account for risk management.
        </p>
      </div>
    </div>
  );
}
