"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { Account, TreasuryConfig, Trade } from "@/lib/treasury/calculations";
import { calculateDrawdown, formatPercentage } from "@/lib/treasury/calculations";

interface AntiDDPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  trades: Trade[];
  onConfigsChange?: (configs: TreasuryConfig[]) => void;
  isReadOnly?: boolean;
}

export default function AntiDDPanel({ accounts, configs, trades, onConfigsChange, isReadOnly }: AntiDDPanelProps) {
  const [localConfigs, setLocalConfigs] = useState<TreasuryConfig[]>(configs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const configMap = new Map(localConfigs.map((c) => [c.account_id, c]));

  const persistUpdate = async (accountId: string, patch: { anti_drawdown_active?: boolean; anti_drawdown_threshold?: number }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/treasury/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, ...patch }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar la configuración");
        return false;
      }
      const { config } = (await res.json()) as { config: TreasuryConfig };
      const next = localConfigs.some((c) => c.account_id === accountId)
        ? localConfigs.map((c) => (c.account_id === accountId ? config : c))
        : [...localConfigs, config];
      setLocalConfigs(next);
      onConfigsChange?.(next);
      return true;
    } catch {
      toast.error("Error de conexión");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleProtection = async (accountId: string, currentActive: boolean) => {
    const ok = await persistUpdate(accountId, { anti_drawdown_active: !currentActive });
    if (ok) toast.success(currentActive ? "Protección desactivada" : "Protección activada");
  };

  const saveThreshold = async (accountId: string) => {
    const parsed = parseFloat(draftValue);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Valor debe estar entre 0 y 100");
      return;
    }
    const ok = await persistUpdate(accountId, { anti_drawdown_threshold: parsed });
    if (ok) {
      toast.success("Umbral actualizado");
      setEditingId(null);
      setDraftValue("");
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-white font-medium">Anti-Drawdown Protection</h3>

      {accounts.map((account) => {
        const config = configMap.get(account.id);
        const antiDDEnabled = config?.anti_drawdown_active || false;
        const antiDDThreshold = config?.anti_drawdown_threshold || 20;
        const drawdown = calculateDrawdown(account.id, account, trades);
        const isBlocked = antiDDEnabled && drawdown >= antiDDThreshold;
        const isEditing = editingId === account.id;

        return (
          <Card
            key={account.id}
            className={`border-2 ${
              isBlocked
                ? "bg-red-900/20 border-red-500/30"
                : antiDDEnabled
                  ? "bg-green-900/20 border-green-500/30"
                  : "bg-slate-900 border-slate-800"
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{account.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-slate-400">Anti-DD Protection</p>
                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <Switch
                      checked={antiDDEnabled}
                      onCheckedChange={() => void toggleProtection(account.id, antiDDEnabled)}
                      disabled={saving}
                    />
                  )}
                  <Badge className={antiDDEnabled ? "bg-green-600" : "bg-gray-600"}>
                    {antiDDEnabled ? "✓ Enabled" : "✗ Disabled"}
                  </Badge>
                </div>
              </div>

              {antiDDEnabled && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-slate-400">DD Threshold (%)</p>
                      {!isReadOnly && !isEditing && (
                        <button
                          onClick={() => {
                            setEditingId(account.id);
                            setDraftValue(String(antiDDThreshold));
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                        >
                          <Pencil size={11} /> Edit
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={100}
                          value={draftValue}
                          onChange={(e) => setDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveThreshold(account.id);
                            if (e.key === "Escape") { setEditingId(null); setDraftValue(""); }
                          }}
                          autoFocus
                          disabled={saving}
                          className="flex-1 px-3 py-1.5 bg-slate-800 border border-cyan-500/40 rounded text-sm text-white font-mono"
                        />
                        <button
                          onClick={() => void saveThreshold(account.id)}
                          disabled={saving}
                          className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                          aria-label="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setDraftValue(""); }}
                          disabled={saving}
                          className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
                          aria-label="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-lg text-slate-300">{formatPercentage(antiDDThreshold)}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-slate-400 mb-1">Current Drawdown</p>
                    <p
                      className={`text-lg font-bold ${
                        drawdown >= antiDDThreshold ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {formatPercentage(drawdown)}
                    </p>
                  </div>

                  {isBlocked && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                      <p className="text-red-400 text-sm">
                        ⚠️ Drawdown exceeds threshold - Withdrawals BLOCKED
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ Anti-Drawdown (Anti-DD) protection pauses withdrawals when account drawdown
          exceeds a specified threshold. Toggle to enable, click <Pencil size={11} className="inline" /> to set the limit.
        </p>
      </div>
    </div>
  );
}
