"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Account, TreasuryConfig } from "@/lib/treasury/calculations";
import { formatCurrency } from "@/lib/treasury/calculations";

interface UmbralPanelProps {
  accounts: Account[];
  configs: TreasuryConfig[];
  onConfigsChange?: (configs: TreasuryConfig[]) => void;
  isReadOnly?: boolean;
}

export default function UmbralPanel({ accounts, configs, onConfigsChange, isReadOnly }: UmbralPanelProps) {
  const [localConfigs, setLocalConfigs] = useState<TreasuryConfig[]>(configs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const configMap = new Map(localConfigs.map((c) => [c.account_id, c]));

  const startEditing = (accountId: string, currentValue: number) => {
    setEditingId(accountId);
    setDraftValue(String(currentValue));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftValue("");
  };

  const saveThreshold = async (accountId: string) => {
    const parsed = parseFloat(draftValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/treasury/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, balance_threshold: parsed }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar el umbral");
        return;
      }
      const { config } = (await res.json()) as { config: TreasuryConfig };
      const next = localConfigs.some((c) => c.account_id === accountId)
        ? localConfigs.map((c) => (c.account_id === accountId ? config : c))
        : [...localConfigs, config];
      setLocalConfigs(next);
      onConfigsChange?.(next);
      toast.success("Umbral actualizado");
      cancelEditing();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-white font-medium">Balance Threshold (Umbral)</h3>

      {accounts.map((account) => {
        const config = configMap.get(account.id);
        const threshold = config?.balance_threshold || 0;
        const currentBalance = account.current_balance || 0;
        const isEligible = currentBalance >= threshold;
        const isEvalPhase = account.phase_status?.includes("fase");
        const isEditing = editingId === account.id;

        return (
          <Card
            key={account.id}
            className={`border-2 ${
              isEvalPhase
                ? "bg-red-900/20 border-red-500/30"
                : isEligible
                  ? "bg-green-900/20 border-green-500/30"
                  : "bg-yellow-900/20 border-yellow-500/30"
            }`}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{account.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(currentBalance)}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-slate-400">Withdrawal Threshold</p>
                  {!isReadOnly && !isEditing && (
                    <button
                      onClick={() => startEditing(account.id, threshold)}
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
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveThreshold(account.id);
                        if (e.key === "Escape") cancelEditing();
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
                      onClick={cancelEditing}
                      disabled={saving}
                      className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded disabled:opacity-50"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p className="text-lg text-slate-300">{formatCurrency(threshold)}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEvalPhase ? (
                  <Badge className="bg-red-600">⚠️ Evaluation Phase</Badge>
                ) : isEligible ? (
                  <Badge className="bg-green-600">✓ Eligible for Withdrawal</Badge>
                ) : (
                  <Badge className="bg-yellow-600">
                    ⏳ Need {formatCurrency(threshold - currentBalance)} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          ℹ️ The balance threshold (Umbral) is the minimum account balance required before
          withdrawals can be made. Click <Pencil size={11} className="inline" /> to edit.
        </p>
      </div>
    </div>
  );
}
